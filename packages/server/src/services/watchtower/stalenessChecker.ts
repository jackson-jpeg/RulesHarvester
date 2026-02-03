import cron from 'node-cron';
import { prisma } from '../../index.js';
import { watchtowerService } from './watchtowerService.js';
import { sseManager } from '../sse/sseManager.js';
import { logger } from '../../utils/logger.js';

/**
 * Staleness Checker Service
 * Enforces a maximum staleness threshold for jurisdiction data
 * Triggers watchtower scans for jurisdictions that haven't been synced recently
 */

// Staleness threshold in days
const STALENESS_THRESHOLD_DAYS = 7;

// Mutex to prevent concurrent staleness checks
let isCheckInProgress = false;
let lastCheckAt: Date | null = null;

class StalenessChecker {
  private scheduledTask: cron.ScheduledTask | null = null;

  /**
   * Check for stale jurisdictions and trigger watchtower scans
   * A jurisdiction is considered stale if:
   * - autoSyncEnabled is true
   * - lastSyncedAt is null OR older than STALENESS_THRESHOLD_DAYS
   */
  async checkForStaleJurisdictions(): Promise<{
    checked: number;
    triggered: number;
    errors: number;
  }> {
    // Prevent concurrent execution
    if (isCheckInProgress) {
      logger.info('Staleness check already in progress, skipping');
      return { checked: 0, triggered: 0, errors: 0 };
    }

    isCheckInProgress = true;
    lastCheckAt = new Date();

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - STALENESS_THRESHOLD_DAYS);

    let checked = 0;
    let triggered = 0;
    let errors = 0;

    try {
      logger.info(
        `Staleness Checker: Looking for jurisdictions not synced since ${thresholdDate.toISOString()}`
      );

      // Find stale jurisdictions
      const staleJurisdictions = await prisma.jurisdiction.findMany({
        where: {
          autoSyncEnabled: true,
          OR: [
            { lastSyncedAt: null },
            { lastSyncedAt: { lt: thresholdDate } },
          ],
        },
        select: {
          id: true,
          code: true,
          name: true,
          lastSyncedAt: true,
          syncFrequency: true,
        },
      });

      checked = staleJurisdictions.length;

      if (staleJurisdictions.length === 0) {
        logger.info('Staleness Checker: No stale jurisdictions found');
        return { checked: 0, triggered: 0, errors: 0 };
      }

      logger.info(
        `Staleness Checker: Found ${staleJurisdictions.length} stale jurisdictions`
      );

      // Trigger watchtower scan for each stale jurisdiction
      for (const jurisdiction of staleJurisdictions) {
        try {
          const staleDays = jurisdiction.lastSyncedAt
            ? Math.floor(
                (Date.now() - jurisdiction.lastSyncedAt.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 'never synced';

          logger.info(
            `Staleness Checker: Triggering scan for ${jurisdiction.name} (${jurisdiction.code}), last synced: ${staleDays} days ago`
          );

          // Trigger watchtower check for this jurisdiction
          const result = await watchtowerService.checkForUpdates(jurisdiction.id);

          // Update lastSyncedAt even if no changes found
          await prisma.jurisdiction.update({
            where: { id: jurisdiction.id },
            data: { lastSyncedAt: new Date() },
          });

          triggered++;

          // Notify via SSE if changes were detected
          if (result.relevantUpdate) {
            sseManager.sendWatchtowerChangeDetected(
              jurisdiction.id,
              `Staleness check detected changes: ${result.changeDescription || 'Unknown changes'}`
            );
          }

          // Add small delay between jurisdictions to avoid overwhelming external servers
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          errors++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          logger.error(
            `Staleness Checker: Failed to check ${jurisdiction.name}: ${errorMessage}`
          );

          // Log to SystemLog for audit trail
          await prisma.systemLog.create({
            data: {
              message: `Staleness check failed for ${jurisdiction.name}: ${errorMessage}`,
              type: 'ERROR',
              metadata: {
                jurisdictionId: jurisdiction.id,
                jurisdictionCode: jurisdiction.code,
                error: errorMessage,
              },
            },
          });
        }
      }

      logger.info(
        `Staleness Checker: Complete - ${triggered} triggered, ${errors} errors`
      );

      // Log summary to SystemLog
      await prisma.systemLog.create({
        data: {
          message: `Staleness check complete: ${checked} checked, ${triggered} triggered, ${errors} errors`,
          type: errors > 0 ? 'WARN' : 'SUCCESS',
          metadata: {
            checked,
            triggered,
            errors,
            thresholdDays: STALENESS_THRESHOLD_DAYS,
          },
        },
      });

      return { checked, triggered, errors };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Staleness Checker: Fatal error - ${errorMessage}`);

      await prisma.systemLog.create({
        data: {
          message: `Staleness check failed: ${errorMessage}`,
          type: 'ERROR',
          metadata: { error: errorMessage },
        },
      });

      throw error;
    } finally {
      isCheckInProgress = false;
    }
  }

  /**
   * Trigger a manual staleness check (e.g., from API endpoint)
   */
  async triggerManualCheck(): Promise<void> {
    logger.info('Staleness Checker: Manual check triggered');
    await this.checkForStaleJurisdictions();
  }

  /**
   * Initialize the staleness checker scheduler
   * Runs daily at 4:00 AM UTC
   */
  initialize(): void {
    // Prevent double initialization
    if (this.scheduledTask) {
      logger.warn('Staleness Checker: Already initialized, skipping');
      return;
    }

    // Schedule daily at 4:00 AM UTC (before the 6:00 AM watchtower daily check)
    this.scheduledTask = cron.schedule('0 4 * * *', async () => {
      logger.info('Staleness Checker: Running scheduled check...');

      try {
        await this.checkForStaleJurisdictions();
      } catch (error) {
        logger.error(
          `Staleness Checker: Scheduled check failed - ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    });

    logger.info(
      'Staleness Checker: Scheduler initialized (Daily at 4:00 AM UTC)'
    );
  }

  /**
   * Stop the scheduler (for graceful shutdown)
   */
  stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      logger.info('Staleness Checker: Scheduler stopped');
    }
  }

  /**
   * Get staleness checker status
   */
  getStatus(): {
    isRunning: boolean;
    lastCheckAt: Date | null;
    thresholdDays: number;
  } {
    return {
      isRunning: isCheckInProgress,
      lastCheckAt,
      thresholdDays: STALENESS_THRESHOLD_DAYS,
    };
  }
}

export const stalenessChecker = new StalenessChecker();
