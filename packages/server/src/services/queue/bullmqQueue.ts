import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../../index.js';
import { sseManager } from '../sse/sseManager.js';
import { extractionService } from '../claude/extractionService.js';
import { swarmDebateService } from '../claude/swarmDebateService.js';
import { dnaAnalysisService } from '../claude/dnaAnalysisService.js';
import { riskProfileService } from '../claude/riskProfileService.js';

export interface ExtractionJobData {
  jobId: string;
  jurisdictionId: string;
  jurisdictionCode: string;
  sourceUrl?: string;
  rawText?: string;
}

// Complexity threshold for tiered processing
const COMPLEXITY_THRESHOLD_SIMPLE = 3;
const COMPLEXITY_THRESHOLD_COMPLEX = 7;

// Redis connection (fallback to in-memory if not available)
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('REDIS_URL not set, BullMQ will not be available');
    return null;
  }
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
};

const connection = getRedisConnection();

// Create queue with per-jurisdiction rate limiting
export const extractionQueueBullMQ = connection ? new Queue<ExtractionJobData>('extraction', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
}) : null;

// Queue events for monitoring
const queueEvents = connection ? new QueueEvents('extraction', { connection }) : null;

if (queueEvents) {
  queueEvents.on('completed', ({ jobId }) => {
    console.log(`BullMQ: Job ${jobId} completed`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`BullMQ: Job ${jobId} failed: ${failedReason}`);
  });
}

// Worker with concurrency control
// Note: Per-domain throttling is handled by job delays based on jurisdictionId
const worker = connection ? new Worker<ExtractionJobData>(
  'extraction',
  async (job) => {
    await processExtractionJob(job.data);
  },
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 1,           // Max 1 job
      duration: 2000,   // Per 2 seconds
    },
  }
) : null;

if (worker) {
  worker.on('error', (err) => {
    console.error('BullMQ Worker error:', err);
  });
}

/**
 * Process an extraction job with tiered AI pipeline
 */
async function processExtractionJob(data: ExtractionJobData) {
  const { jobId, jurisdictionId, jurisdictionCode, rawText, sourceUrl } = data;

  try {
    console.log(`Processing extraction job ${jobId} for ${jurisdictionCode}`);

    // Step 1: Extract rule data (0-25%)
    await updateJobProgress(jobId, 5, 'Extracting rule data...');

    if (!rawText) {
      throw new Error('No rule text provided for extraction');
    }

    const extractionResult = await extractionService.extractRule(rawText, jurisdictionId);
    await updateJobProgress(jobId, 25, 'Rule data extracted');

    // Step 2: Assess complexity (25-35%)
    await updateJobProgress(jobId, 30, 'Assessing complexity...');
    const complexity = await extractionService.assessComplexity(rawText);
    await updateJobProgress(jobId, 35, `Complexity: ${complexity.score}/10`);

    // TIERED AI PIPELINE: Skip expensive operations for simple rules
    let swarmDebate = null;
    let riskProfile = null;
    let dna = null;

    if (complexity.score <= COMPLEXITY_THRESHOLD_SIMPLE) {
      // Simple rule: Skip swarm debate, risk profile, and DNA analysis
      console.log(`Job ${jobId}: Simple rule (complexity ${complexity.score}), skipping advanced analysis`);
      await updateJobProgress(jobId, 70, 'Simple rule - skipping advanced analysis');

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
      await updateJobProgress(jobId, 40, 'Generating swarm debate...');
      swarmDebate = await swarmDebateService.generateDebate(rawText, extractionResult.ruleCode);
      await updateJobProgress(jobId, 55, 'Swarm debate complete', swarmDebate.consensusScore);

      // Step 4: Predict risk profile (55-70%)
      await updateJobProgress(jobId, 60, 'Analyzing risk profile...');
      riskProfile = await riskProfileService.predictRisk(
        {
          ruleCode: extractionResult.ruleCode,
          name: extractionResult.name,
          deadlines: extractionResult.deadlines,
          rawText,
        },
        jurisdictionCode
      );
      await updateJobProgress(jobId, 70, 'Risk profile complete');

      // Step 5: Analyze jurisdiction DNA for complex rules (70-85%)
      if (complexity.score >= COMPLEXITY_THRESHOLD_COMPLEX) {
        await updateJobProgress(jobId, 75, 'Analyzing jurisdiction DNA...');
        const jurisdiction = await prisma.jurisdiction.findUnique({
          where: { id: jurisdictionId },
        });
        dna = await dnaAnalysisService.analyzeJurisdiction(
          jurisdiction?.name || jurisdictionCode,
          [rawText]
        );
        await updateJobProgress(jobId, 85, 'DNA analysis complete');
      } else {
        await updateJobProgress(jobId, 85, 'Skipping DNA analysis for moderate complexity');
      }
    }

    // Step 6: Create rule record (85-95%)
    await updateJobProgress(jobId, 90, 'Saving rule...');

    const rule = await prisma.rule.create({
      data: {
        ruleCode: extractionResult.ruleCode,
        name: extractionResult.name,
        jurisdictionId,
        triggerType: extractionResult.triggerType,
        sourceUrl,
        rawText,
        confidenceScore: extractionResult.confidenceScore,
        extractionReasoning: extractionResult.extractionReasoning,
        complexity: complexity.score,
        deadlines: JSON.stringify(extractionResult.deadlines),
        relatedRules: JSON.stringify(extractionResult.relatedRules),
        dna: dna ? JSON.stringify(dna) : undefined,
        riskProfile: JSON.stringify(riskProfile),
        swarmDebate: JSON.stringify(swarmDebate),
        auditHistory: JSON.stringify([
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date(),
            action: 'created',
            user: 'system',
            hash: Buffer.from(JSON.stringify(extractionResult)).toString('base64').slice(0, 16),
          },
        ]),
      },
    });

    // Update jurisdiction
    const updateData: Record<string, unknown> = {
      ruleCount: { increment: 1 },
      status: 'SYNCED',
      lastSyncedAt: new Date(),
    };
    if (dna) {
      updateData.dna = JSON.stringify(dna);
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
    throw error; // Re-throw for BullMQ retry logic
  }
}

async function updateJobProgress(
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

/**
 * Add a job to the extraction queue
 */
export async function addExtractionJob(data: ExtractionJobData): Promise<void> {
  if (extractionQueueBullMQ) {
    await extractionQueueBullMQ.add('extract', data, {
      // Group by jurisdiction for rate limiting
      jobId: data.jobId,
    });
    console.log(`BullMQ: Job ${data.jobId} queued for ${data.jurisdictionCode}`);
  } else {
    // Fallback to in-memory processing
    console.log(`BullMQ unavailable, processing job ${data.jobId} directly`);
    await processExtractionJob(data);
  }
}

/**
 * Get queue stats
 */
export async function getQueueStats() {
  if (!extractionQueueBullMQ) {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    extractionQueueBullMQ.getWaitingCount(),
    extractionQueueBullMQ.getActiveCount(),
    extractionQueueBullMQ.getCompletedCount(),
    extractionQueueBullMQ.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
