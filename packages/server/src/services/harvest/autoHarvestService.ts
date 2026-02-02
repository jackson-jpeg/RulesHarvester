import { prisma } from '../../index.js';
import { JurisdictionStatus } from '@rulesharvester/shared';
import { sseManager } from '../sse/sseManager.js';
import { inboxService } from '../inbox/inboxService.js';
import { InboxItemType, CONFIDENCE_THRESHOLDS } from '@rulesharvester/shared';
import { logger } from '../../utils/logger.js';
import { getScrapingStrategy } from '../scraper/aiScraper.js';
import { scraperService } from '../scraper/scraperService.js';
import { extractionQueue } from '../queue/extractionQueue.js';

interface HarvestResult {
  jurisdictionId: string;
  success: boolean;
  rulesExtracted: number;
  error?: string;
}

class AutoHarvestService {
  private harvestingInProgress: Set<string> = new Set();

  /**
   * Main entry point - initiate auto-harvest for a jurisdiction
   */
  async initiateHarvest(jurisdictionId: string): Promise<HarvestResult> {
    // Prevent concurrent harvesting for the same jurisdiction
    if (this.harvestingInProgress.has(jurisdictionId)) {
      logger.info(
        `AutoHarvest: Already harvesting ${jurisdictionId}, skipping duplicate request`
      );
      return {
        jurisdictionId,
        success: false,
        rulesExtracted: 0,
        error: 'Harvest already in progress',
      };
    }

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: jurisdictionId },
      select: {
        id: true,
        name: true,
        code: true,
        courtWebsite: true,
        scraperConfig: true,
      },
    });

    if (!jurisdiction) {
      logger.error(`AutoHarvest: Jurisdiction ${jurisdictionId} not found`);
      return {
        jurisdictionId,
        success: false,
        rulesExtracted: 0,
        error: 'Jurisdiction not found',
      };
    }

    if (!jurisdiction.courtWebsite) {
      logger.error(
        `AutoHarvest: Jurisdiction ${jurisdiction.name} has no court website`
      );
      return {
        jurisdictionId,
        success: false,
        rulesExtracted: 0,
        error: 'No court website configured',
      };
    }

    this.harvestingInProgress.add(jurisdictionId);

    try {
      // Update status to AUTO_HARVESTING
      await prisma.jurisdiction.update({
        where: { id: jurisdictionId },
        data: { status: JurisdictionStatus.AUTO_HARVESTING },
      });

      sseManager.sendAutoHarvestStarted(jurisdictionId, jurisdiction.name);
      logger.info(`AutoHarvest: Starting harvest for ${jurisdiction.name}`);

      // Step 1: Get or discover scraper configuration
      sseManager.sendAutoHarvestProgress(
        jurisdictionId,
        'Discovering scraper configuration',
        10
      );

      const scraperConfig = await getScrapingStrategy(
        jurisdiction.courtWebsite,
        jurisdictionId
      );

      logger.info(
        `AutoHarvest: Got scraper config for ${jurisdiction.name} ` +
          `(confidence: ${scraperConfig.confidence}%)`
      );

      // Step 2: Crawl the site to find rule pages
      sseManager.sendAutoHarvestProgress(
        jurisdictionId,
        'Crawling site for rule pages',
        30
      );

      const crawlResult = await scraperService.crawlSite(
        jurisdiction.courtWebsite,
        {
          maxPages: 30,
          followLinks: true,
          jurisdictionId,
        }
      );

      logger.info(
        `AutoHarvest: Crawled ${crawlResult.pages.length} pages for ${jurisdiction.name}`
      );

      // Step 3: Extract rule candidates from crawled pages
      sseManager.sendAutoHarvestProgress(
        jurisdictionId,
        'Extracting rule candidates',
        50
      );

      const ruleCandidates: Array<{
        ruleCode: string;
        snippet: string;
        relevanceScore: number;
        sourceUrl: string;
      }> = [];

      for (const page of crawlResult.pages) {
        const candidates = scraperService.extractRuleCandidates(page);
        for (const candidate of candidates) {
          ruleCandidates.push({
            ...candidate,
            sourceUrl: page.url,
          });
        }
      }

      // Deduplicate by rule code
      const uniqueCandidates = new Map<
        string,
        (typeof ruleCandidates)[number]
      >();
      for (const candidate of ruleCandidates) {
        const existing = uniqueCandidates.get(candidate.ruleCode);
        if (!existing || candidate.relevanceScore > existing.relevanceScore) {
          uniqueCandidates.set(candidate.ruleCode, candidate);
        }
      }

      const finalCandidates = Array.from(uniqueCandidates.values());
      logger.info(
        `AutoHarvest: Found ${finalCandidates.length} unique rule candidates for ${jurisdiction.name}`
      );

      // Step 4: Create extraction jobs for each candidate
      sseManager.sendAutoHarvestProgress(
        jurisdictionId,
        'Creating extraction jobs',
        70
      );

      let jobsCreated = 0;
      for (const candidate of finalCandidates) {
        // Filter by relevance score
        if (candidate.relevanceScore < 30) {
          logger.debug(
            `AutoHarvest: Skipping low-relevance candidate ${candidate.ruleCode} ` +
              `(score: ${candidate.relevanceScore})`
          );
          continue;
        }

        // Check if rule already exists
        const existingRule = await prisma.rule.findFirst({
          where: {
            jurisdictionId,
            ruleCode: candidate.ruleCode,
          },
        });

        if (existingRule) {
          logger.debug(
            `AutoHarvest: Rule ${candidate.ruleCode} already exists, skipping`
          );
          continue;
        }

        // Create extraction job
        const job = await prisma.extractionJob.create({
          data: {
            jurisdictionId,
            jurisdictionCode: jurisdiction.code,
            status: 'PENDING',
            sourceUrl: candidate.sourceUrl,
            rawText: candidate.snippet,
          },
        });

        // Add to extraction queue
        await extractionQueue.add('extraction', {
          jobId: job.id,
          jurisdictionId,
          jurisdictionCode: jurisdiction.code,
          sourceUrl: candidate.sourceUrl,
          rawText: candidate.snippet,
        });

        jobsCreated++;
      }

      // Step 5: Update status
      sseManager.sendAutoHarvestProgress(
        jurisdictionId,
        'Completing harvest',
        90
      );

      const finalStatus =
        jobsCreated > 0 ? JurisdictionStatus.SYNCED : JurisdictionStatus.IDLE;

      await prisma.jurisdiction.update({
        where: { id: jurisdictionId },
        data: {
          status: finalStatus,
          lastSyncedAt: new Date(),
        },
      });

      sseManager.sendAutoHarvestComplete(jurisdictionId, jobsCreated);
      logger.info(
        `AutoHarvest: Completed for ${jurisdiction.name}, created ${jobsCreated} extraction jobs`
      );

      this.harvestingInProgress.delete(jurisdictionId);
      return {
        jurisdictionId,
        success: true,
        rulesExtracted: jobsCreated,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        `AutoHarvest: Failed for ${jurisdiction.name}: ${errorMessage}`
      );

      // Update status to FAILED
      await prisma.jurisdiction.update({
        where: { id: jurisdictionId },
        data: {
          status: JurisdictionStatus.FAILED,
        },
      });

      sseManager.sendAutoHarvestFailed(jurisdictionId, errorMessage);
      this.harvestingInProgress.delete(jurisdictionId);

      return {
        jurisdictionId,
        success: false,
        rulesExtracted: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if harvesting is in progress for a jurisdiction
   */
  isHarvesting(jurisdictionId: string): boolean {
    return this.harvestingInProgress.has(jurisdictionId);
  }

  /**
   * Get all currently harvesting jurisdictions
   */
  getHarvestingJurisdictions(): string[] {
    return Array.from(this.harvestingInProgress);
  }
}

export const autoHarvestService = new AutoHarvestService();

/**
 * Helper function to route extracted rules based on confidence
 */
export async function routeExtractedRule(
  ruleId: string,
  ruleName: string,
  confidence: number,
  sourceUrl?: string
): Promise<void> {
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
    // High confidence - automatically verified
    logger.info(
      `AutoHarvest: Rule ${ruleName} auto-verified (confidence: ${confidence}%)`
    );
    return;
  }

  if (confidence >= CONFIDENCE_THRESHOLDS.MANUAL_REVIEW) {
    // Medium confidence - needs manual review
    logger.info(
      `AutoHarvest: Rule ${ruleName} needs verification (confidence: ${confidence}%)`
    );

    // Check if inbox item already exists
    const exists = await inboxService.existsForEntity(
      InboxItemType.RULE_VERIFICATION,
      ruleId
    );

    if (!exists) {
      await inboxService.createRuleVerificationItem(
        ruleId,
        ruleName,
        confidence,
        sourceUrl
      );
    }
    return;
  }

  // Low confidence - flag for review or reject
  logger.warn(
    `AutoHarvest: Rule ${ruleName} flagged as low confidence (${confidence}%)`
  );

  const exists = await inboxService.existsForEntity(
    InboxItemType.RULE_VERIFICATION,
    ruleId
  );

  if (!exists) {
    await inboxService.createRuleVerificationItem(
      ruleId,
      ruleName,
      confidence,
      sourceUrl,
      { autoRejectCandidate: true }
    );
  }
}
