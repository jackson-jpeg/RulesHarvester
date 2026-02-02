import { prisma } from '../../index.js';
import { SCRAPER_HEALTH } from '@rulesharvester/shared';
import { sseManager } from '../sse/sseManager.js';
import { inboxService } from '../inbox/inboxService.js';
import { InboxItemType } from '@rulesharvester/shared';
import { logger } from '../../utils/logger.js';
import { getScrapingStrategy } from './aiScraper.js';

interface ScrapeResultRecord {
  jurisdictionId: string;
  success: boolean;
  error?: string;
  statusCode?: number;
}

class ScraperHealthService {
  private healingInProgress: Set<string> = new Set();
  private lastHealingAttempt: Map<string, number> = new Map();

  /**
   * Record the result of a scrape attempt
   */
  async recordScrapeResult(result: ScrapeResultRecord): Promise<void> {
    const { jurisdictionId, success, error, statusCode } = result;

    if (success) {
      // Reset failure count on success
      await prisma.jurisdiction.update({
        where: { id: jurisdictionId },
        data: {
          consecutiveScrapeFailures: 0,
          lastScrapeError: null,
          lastSuccessfulScrape: new Date(),
        },
      });
      return;
    }

    // Increment failure count
    const jurisdiction = await prisma.jurisdiction.update({
      where: { id: jurisdictionId },
      data: {
        consecutiveScrapeFailures: { increment: 1 },
        lastScrapeError: error || `HTTP ${statusCode}`,
      },
      select: {
        id: true,
        name: true,
        consecutiveScrapeFailures: true,
        courtWebsite: true,
      },
    });

    logger.warn(
      `Scraper: Failure recorded for ${jurisdiction.name} ` +
        `(${jurisdiction.consecutiveScrapeFailures}/${SCRAPER_HEALTH.MAX_CONSECUTIVE_FAILURES}): ${error}`
    );

    // Check if we should trigger healing
    if (
      jurisdiction.consecutiveScrapeFailures >= SCRAPER_HEALTH.MAX_CONSECUTIVE_FAILURES
    ) {
      await this.checkAndHeal(jurisdictionId);
    }
  }

  /**
   * Check if healing should be triggered and execute if needed
   */
  async checkAndHeal(jurisdictionId: string): Promise<boolean> {
    // Prevent concurrent healing for the same jurisdiction
    if (this.healingInProgress.has(jurisdictionId)) {
      logger.info(
        `Scraper: Healing already in progress for ${jurisdictionId}, skipping`
      );
      return false;
    }

    // Check cooldown
    const lastAttempt = this.lastHealingAttempt.get(jurisdictionId) || 0;
    const now = Date.now();
    if (now - lastAttempt < SCRAPER_HEALTH.HEALING_COOLDOWN_MS) {
      logger.info(
        `Scraper: Healing on cooldown for ${jurisdictionId}, skipping`
      );
      return false;
    }

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: jurisdictionId },
      select: {
        id: true,
        name: true,
        courtWebsite: true,
        consecutiveScrapeFailures: true,
        scraperConfigVersion: true,
      },
    });

    if (!jurisdiction) {
      logger.warn(`Scraper: Jurisdiction ${jurisdictionId} not found`);
      return false;
    }

    if (
      jurisdiction.consecutiveScrapeFailures < SCRAPER_HEALTH.MAX_CONSECUTIVE_FAILURES
    ) {
      return false;
    }

    return this.triggerRediscovery(jurisdictionId);
  }

  /**
   * Trigger re-discovery of scraper configuration
   */
  async triggerRediscovery(jurisdictionId: string): Promise<boolean> {
    this.healingInProgress.add(jurisdictionId);
    this.lastHealingAttempt.set(jurisdictionId, Date.now());

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: jurisdictionId },
      select: {
        id: true,
        name: true,
        courtWebsite: true,
        scraperConfigVersion: true,
      },
    });

    if (!jurisdiction || !jurisdiction.courtWebsite) {
      this.healingInProgress.delete(jurisdictionId);
      logger.error(`Scraper: Cannot heal ${jurisdictionId} - missing court website`);
      return false;
    }

    try {
      sseManager.sendScraperHealingStarted(jurisdictionId, jurisdiction.name);
      logger.info(`Scraper: Starting self-healing for ${jurisdiction.name}`);

      // Clear existing scraper config to force re-discovery
      await prisma.jurisdiction.update({
        where: { id: jurisdictionId },
        data: {
          scraperConfig: undefined,
        },
      });

      // Trigger re-discovery
      const newConfig = await getScrapingStrategy(
        jurisdiction.courtWebsite,
        jurisdictionId
      );

      // Check if the new config has reasonable confidence
      if (newConfig.confidence && newConfig.confidence >= 50) {
        // Success - update config version and reset failures
        await prisma.jurisdiction.update({
          where: { id: jurisdictionId },
          data: {
            scraperConfigVersion: { increment: 1 },
            consecutiveScrapeFailures: 0,
            lastScrapeError: null,
          },
        });

        sseManager.sendScraperHealingComplete(jurisdictionId, jurisdiction.name);
        logger.info(
          `Scraper: Self-healing successful for ${jurisdiction.name} ` +
            `(confidence: ${newConfig.confidence}%)`
        );

        this.healingInProgress.delete(jurisdictionId);
        return true;
      }

      // Low confidence - consider it a failure
      throw new Error(
        `Re-discovery produced low confidence config (${newConfig.confidence}%)`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        `Scraper: Self-healing failed for ${jurisdiction.name}: ${errorMessage}`
      );

      sseManager.sendScraperHealingFailed(
        jurisdictionId,
        jurisdiction.name,
        errorMessage
      );

      // Create inbox item for manual intervention
      const existingItem = await inboxService.existsForEntity(
        InboxItemType.SCRAPER_FAILURE,
        jurisdictionId
      );

      if (!existingItem) {
        await inboxService.createScraperFailureItem(
          jurisdictionId,
          jurisdiction.name,
          errorMessage,
          {
            courtWebsite: jurisdiction.courtWebsite,
            scraperConfigVersion: jurisdiction.scraperConfigVersion,
            lastHealingAttempt: new Date().toISOString(),
          }
        );
      }

      this.healingInProgress.delete(jurisdictionId);
      return false;
    }
  }

  /**
   * Get health status for all jurisdictions
   */
  async getHealthStatus(): Promise<{
    healthy: number;
    degraded: number;
    failed: number;
    jurisdictions: Array<{
      id: string;
      name: string;
      consecutiveScrapeFailures: number;
      lastScrapeError: string | null;
      lastSuccessfulScrape: Date | null;
      status: 'healthy' | 'degraded' | 'failed';
    }>;
  }> {
    const jurisdictions = await prisma.jurisdiction.findMany({
      where: { autoSyncEnabled: true },
      select: {
        id: true,
        name: true,
        consecutiveScrapeFailures: true,
        lastScrapeError: true,
        lastSuccessfulScrape: true,
      },
    });

    let healthy = 0;
    let degraded = 0;
    let failed = 0;

    const mapped = jurisdictions.map((j) => {
      let status: 'healthy' | 'degraded' | 'failed';

      if (j.consecutiveScrapeFailures === 0) {
        status = 'healthy';
        healthy++;
      } else if (
        j.consecutiveScrapeFailures >= SCRAPER_HEALTH.MAX_CONSECUTIVE_FAILURES
      ) {
        status = 'failed';
        failed++;
      } else {
        status = 'degraded';
        degraded++;
      }

      return {
        id: j.id,
        name: j.name,
        consecutiveScrapeFailures: j.consecutiveScrapeFailures,
        lastScrapeError: j.lastScrapeError,
        lastSuccessfulScrape: j.lastSuccessfulScrape,
        status,
      };
    });

    return {
      healthy,
      degraded,
      failed,
      jurisdictions: mapped,
    };
  }

  /**
   * Manually trigger healing for a jurisdiction
   */
  async manualHeal(jurisdictionId: string): Promise<boolean> {
    // Reset failure count to force healing
    await prisma.jurisdiction.update({
      where: { id: jurisdictionId },
      data: {
        consecutiveScrapeFailures: SCRAPER_HEALTH.MAX_CONSECUTIVE_FAILURES,
      },
    });

    // Clear cooldown
    this.lastHealingAttempt.delete(jurisdictionId);

    return this.triggerRediscovery(jurisdictionId);
  }
}

export const scraperHealthService = new ScraperHealthService();
