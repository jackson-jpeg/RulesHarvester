import { prisma } from '../../index.js';
import { sseManager } from '../sse/sseManager.js';
import { extractionService } from '../claude/extractionService.js';
import { swarmDebateService } from '../claude/swarmDebateService.js';
import { dnaAnalysisService } from '../claude/dnaAnalysisService.js';
import { riskProfileService } from '../claude/riskProfileService.js';
import { addExtractionJob, extractionQueueBullMQ } from './bullmqQueue.js';

interface ExtractionJobData {
  jobId: string;
  jurisdictionId: string;
  jurisdictionCode: string;
  sourceUrl?: string;
  rawText?: string;
}

// Complexity thresholds for tiered processing
const COMPLEXITY_THRESHOLD_SIMPLE = 3;
const COMPLEXITY_THRESHOLD_COMPLEX = 7;

// Maximum queue size for in-memory fallback (prevents unbounded memory growth)
const MAX_QUEUE_SIZE = 100;

// In-memory queue for local development (no Redis required)
// When Redis is available, jobs are routed to BullMQ instead
class InMemoryQueue {
  private jobs: ExtractionJobData[] = [];
  private processing = false;
  private concurrency = 3;
  private activeJobs = 0;

  async add(_name: string, data: ExtractionJobData) {
    // If BullMQ is available, use it for per-domain throttling
    if (extractionQueueBullMQ) {
      await addExtractionJob(data);
      return;
    }

    // Enforce max queue size for in-memory fallback
    if (this.jobs.length >= MAX_QUEUE_SIZE) {
      throw new Error(`Queue full: maximum ${MAX_QUEUE_SIZE} pending jobs allowed. Please wait for existing jobs to complete or configure Redis.`);
    }

    // Otherwise, use in-memory queue
    this.jobs.push(data);
    console.log(`Job queued (in-memory): ${data.jobId} (queue size: ${this.jobs.length})`);
    this.processNext();
  }

  private async processNext() {
    if (this.processing && this.activeJobs >= this.concurrency) return;
    if (this.jobs.length === 0) return;

    const job = this.jobs.shift();
    if (!job) return;

    this.activeJobs++;
    this.processing = true;

    try {
      await this.processJob(job);
    } catch (error) {
      console.error(`Job ${job.jobId} failed:`, error);
    } finally {
      this.activeJobs--;
      if (this.jobs.length > 0) {
        this.processNext();
      } else if (this.activeJobs === 0) {
        this.processing = false;
      }
    }
  }

  private async processJob(job: ExtractionJobData) {
    const { jobId, jurisdictionId, jurisdictionCode, rawText } = job;

    try {
      console.log(`Processing extraction job ${jobId} for ${jurisdictionCode}`);

      // Step 1: Extract rule data (0-25%)
      await this.updateJobProgress(jobId, 5, 'Extracting rule data...');

      if (!rawText) {
        throw new Error('No rule text provided for extraction');
      }

      const extractionResult = await extractionService.extractRule(rawText, jurisdictionId);
      await this.updateJobProgress(jobId, 25, 'Rule data extracted');

      // Step 2: Assess complexity (25-35%)
      await this.updateJobProgress(jobId, 30, 'Assessing complexity...');
      const complexity = await extractionService.assessComplexity(rawText);
      await this.updateJobProgress(jobId, 35, `Complexity: ${complexity.score}/10`);

      // TIERED AI PIPELINE: Skip expensive operations for simple rules
      let swarmDebate;
      let riskProfile;
      let dna;

      if (complexity.score <= COMPLEXITY_THRESHOLD_SIMPLE) {
        // Simple rule: Skip swarm debate, risk profile, and DNA analysis
        console.log(`Job ${jobId}: Simple rule (complexity ${complexity.score}), skipping advanced analysis`);
        await this.updateJobProgress(jobId, 70, 'Simple rule - skipping advanced analysis');

        swarmDebate = {
          debateSummary: 'Skipped: Simple rule with low complexity',
          agentCritiques: [],
          consensusScore: 100,
        };
        riskProfile = {
          sanctionProbability: 5,
          administrativeFriction: 1,
          riskFactors: ['Standard procedural rule'],
          mitigationStrategy: 'Follow standard filing procedures',
        };
        dna = null; // Will use jurisdiction's existing DNA
      } else {
        // Complex rule: Full processing pipeline

        // Step 3: Generate swarm debate (35-55%)
        await this.updateJobProgress(jobId, 40, 'Generating swarm debate...');
        swarmDebate = await swarmDebateService.generateDebate(rawText, extractionResult.ruleCode);
        await this.updateJobProgress(jobId, 55, 'Swarm debate complete', swarmDebate.consensusScore);

        // Step 4: Predict risk profile (55-70%)
        await this.updateJobProgress(jobId, 60, 'Analyzing risk profile...');
        riskProfile = await riskProfileService.predictRisk(
          {
            ruleCode: extractionResult.ruleCode,
            name: extractionResult.name,
            deadlines: extractionResult.deadlines,
            rawText,
          },
          jurisdictionCode
        );
        await this.updateJobProgress(jobId, 70, 'Risk profile complete');

        // Step 5: Analyze jurisdiction DNA for complex rules (70-85%)
        if (complexity.score >= COMPLEXITY_THRESHOLD_COMPLEX) {
          await this.updateJobProgress(jobId, 75, 'Analyzing jurisdiction DNA...');
          const jurisdiction = await prisma.jurisdiction.findUnique({
            where: { id: jurisdictionId },
          });
          dna = await dnaAnalysisService.analyzeJurisdiction(
            jurisdiction?.name || jurisdictionCode,
            [rawText]
          );
          await this.updateJobProgress(jobId, 85, 'DNA analysis complete');
        } else {
          await this.updateJobProgress(jobId, 85, 'Skipping DNA for moderate complexity');
          dna = null;
        }
      }

      // Step 6: Create rule record (85-95%)
      await this.updateJobProgress(jobId, 90, 'Saving rule...');

      const rule = await prisma.rule.create({
        data: {
          ruleCode: extractionResult.ruleCode,
          name: extractionResult.name,
          jurisdictionId,
          triggerType: extractionResult.triggerType,
          sourceUrl: job.sourceUrl,
          rawText,
          confidenceScore: extractionResult.confidenceScore,
          extractionReasoning: extractionResult.extractionReasoning,
          complexity: complexity.score,
          // Prisma Json fields need explicit casting for TypeScript
          deadlines: extractionResult.deadlines as unknown as [],
          relatedRules: extractionResult.relatedRules as unknown as [],
          dna: dna as unknown as object ?? undefined,
          riskProfile: riskProfile as unknown as object,
          swarmDebate: swarmDebate as unknown as object,
          auditHistory: [
            {
              id: `audit-${Date.now()}`,
              timestamp: new Date().toISOString(),
              action: 'created',
              user: 'system',
              hash: Buffer.from(JSON.stringify(extractionResult)).toString('base64').slice(0, 16),
            },
          ],
        },
      });

      // Update jurisdiction
      const updateData: Record<string, unknown> = {
        ruleCount: { increment: 1 },
        status: 'SYNCED',
        lastSyncedAt: new Date(),
      };
      if (dna) {
        // Prisma Json fields need explicit casting for TypeScript
        updateData.dna = dna as unknown as object;
      }
      await prisma.jurisdiction.update({
        where: { id: jurisdictionId },
        data: updateData,
      });

      // Step 7: Complete
      await prisma.extractionJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          currentStep: 'Complete',
          ruleId: rule.id,
          agentConsensus: swarmDebate?.consensusScore,
        },
      });

      sseManager.sendJobCompleted(jobId, rule.id, jurisdictionId);
      console.log(`Completed extraction job ${jobId}, created rule ${rule.id}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Extraction job ${jobId} failed:`, errorMessage);

      await prisma.extractionJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: errorMessage,
          currentStep: 'Failed',
        },
      });

      sseManager.sendJobFailed(jobId, errorMessage);
    }
  }

  private async updateJobProgress(
    jobId: string,
    progress: number,
    currentStep: string,
    agentConsensus?: number
  ) {
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        progress,
        currentStep,
        agentConsensus,
        status: 'PROCESSING',
      },
    });

    sseManager.sendJobProgress(jobId, progress, currentStep, agentConsensus);
  }
}

export const extractionQueue = new InMemoryQueue();
