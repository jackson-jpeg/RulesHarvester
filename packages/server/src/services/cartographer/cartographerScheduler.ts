import cron from 'node-cron';
import { cartographerService } from './cartographerService.js';
import { sseManager } from '../sse/sseManager.js';
import { prisma } from '../../index.js';
import { JurisdictionType } from '@rulesharvester/shared';
import { logger } from '../../utils/logger.js';

// Mutex for preventing concurrent scheduler runs
let schedulerMutex = false;
let mutexAcquiredAt: number | null = null;
const MUTEX_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes auto-release

class CartographerScheduler {
  private weeklyTask: cron.ScheduledTask | null = null;
  private dailyTask: cron.ScheduledTask | null = null;

  /**
   * Acquire the scheduler mutex
   */
  private acquireMutex(): boolean {
    // Check for stale mutex
    if (schedulerMutex && mutexAcquiredAt) {
      const elapsed = Date.now() - mutexAcquiredAt;
      if (elapsed > MUTEX_TIMEOUT_MS) {
        logger.warn('CartographerScheduler: Releasing stale mutex');
        schedulerMutex = false;
        mutexAcquiredAt = null;
      }
    }

    if (schedulerMutex) {
      return false;
    }

    schedulerMutex = true;
    mutexAcquiredAt = Date.now();
    return true;
  }

  /**
   * Release the scheduler mutex
   */
  private releaseMutex(): void {
    schedulerMutex = false;
    mutexAcquiredAt = null;
  }

  /**
   * Get random jitter to avoid overwhelming external APIs
   */
  private getRandomJitter(): number {
    return Math.floor(Math.random() * 60000); // 0-60 seconds
  }

  /**
   * Run broad discovery - searches all jurisdiction types
   */
  async runBroadDiscovery(): Promise<number> {
    if (!this.acquireMutex()) {
      logger.info('CartographerScheduler: Broad discovery skipped (mutex held)');
      return 0;
    }

    try {
      // Add random jitter
      const jitter = this.getRandomJitter();
      logger.info(
        `CartographerScheduler: Starting broad discovery in ${jitter}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, jitter));

      sseManager.sendCartographerScheduledRunStarted('WEEKLY');

      const results = await cartographerService.discoverJurisdictions({
        jurisdictionTypes: [
          JurisdictionType.FEDERAL_CIRCUIT,
          JurisdictionType.FEDERAL_DISTRICT,
          JurisdictionType.STATE,
        ],
        maxResults: 20,
      });

      sseManager.sendCartographerScheduledRunComplete(results.length);
      logger.info(
        `CartographerScheduler: Broad discovery complete - found ${results.length} jurisdictions`
      );

      // Log to SystemLog for audit trail
      await prisma.systemLog.create({
        data: {
          message: `Cartographer weekly discovery complete: ${results.length} new jurisdictions found`,
          type: 'INFO',
          metadata: {
            frequency: 'WEEKLY',
            discoveredCount: results.length,
            jurisdictionTypes: ['FEDERAL_CIRCUIT', 'FEDERAL_DISTRICT', 'STATE'],
          },
        },
      });

      return results.length;
    } catch (error) {
      logger.error('CartographerScheduler: Broad discovery failed', { error: error instanceof Error ? error.message : String(error) });

      await prisma.systemLog.create({
        data: {
          message: `Cartographer weekly discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          metadata: { frequency: 'WEEKLY', error: String(error) },
        },
      });

      return 0;
    } finally {
      this.releaseMutex();
    }
  }

  /**
   * Run targeted discovery - focuses on missing state jurisdictions
   */
  async runTargetedDiscovery(): Promise<number> {
    if (!this.acquireMutex()) {
      logger.info(
        'CartographerScheduler: Targeted discovery skipped (mutex held)'
      );
      return 0;
    }

    try {
      // Add random jitter
      const jitter = this.getRandomJitter();
      logger.info(
        `CartographerScheduler: Starting targeted discovery in ${jitter}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, jitter));

      sseManager.sendCartographerScheduledRunStarted('DAILY');

      // Get count of state jurisdictions to prioritize filling gaps
      const stateCount = await prisma.jurisdiction.count({
        where: { type: JurisdictionType.STATE },
      });

      // If we have fewer than 50 states, focus on state discovery
      const jurisdictionTypes =
        stateCount < 50
          ? [JurisdictionType.STATE]
          : [
              JurisdictionType.FEDERAL_CIRCUIT,
              JurisdictionType.FEDERAL_DISTRICT,
            ];

      const results = await cartographerService.discoverJurisdictions({
        jurisdictionTypes,
        maxResults: 10,
      });

      sseManager.sendCartographerScheduledRunComplete(results.length);
      logger.info(
        `CartographerScheduler: Targeted discovery complete - found ${results.length} jurisdictions`
      );

      // Log to SystemLog for audit trail
      await prisma.systemLog.create({
        data: {
          message: `Cartographer daily discovery complete: ${results.length} new jurisdictions found`,
          type: 'INFO',
          metadata: {
            frequency: 'DAILY',
            discoveredCount: results.length,
            jurisdictionTypes: jurisdictionTypes.map((t) => t.toString()),
            targetedReason:
              stateCount < 50 ? 'Filling state gaps' : 'General federal',
          },
        },
      });

      return results.length;
    } catch (error) {
      logger.error('CartographerScheduler: Targeted discovery failed', { error: error instanceof Error ? error.message : String(error) });

      await prisma.systemLog.create({
        data: {
          message: `Cartographer daily discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          metadata: { frequency: 'DAILY', error: String(error) },
        },
      });

      return 0;
    } finally {
      this.releaseMutex();
    }
  }

  /**
   * Initialize the scheduler with cron jobs
   */
  initialize(): void {
    // Weekly: Sundays at 2:00 AM UTC (broad discovery)
    this.weeklyTask = cron.schedule('0 2 * * 0', async () => {
      logger.info('CartographerScheduler: Running weekly scheduled discovery');
      await this.runBroadDiscovery();
    });

    // Daily: 5:00 AM UTC (targeted discovery)
    this.dailyTask = cron.schedule('0 5 * * *', async () => {
      logger.info('CartographerScheduler: Running daily scheduled discovery');
      await this.runTargetedDiscovery();
    });

    logger.info(
      'CartographerScheduler initialized (Weekly: Sun 2:00 AM UTC, Daily: 5:00 AM UTC)'
    );
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.weeklyTask) {
      this.weeklyTask.stop();
      this.weeklyTask = null;
    }
    if (this.dailyTask) {
      this.dailyTask.stop();
      this.dailyTask = null;
    }
    logger.info('CartographerScheduler stopped');
  }

  /**
   * Check if a run is currently in progress
   */
  isRunning(): boolean {
    return schedulerMutex;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    mutexAcquiredAt: Date | null;
  } {
    return {
      isRunning: schedulerMutex,
      mutexAcquiredAt: mutexAcquiredAt ? new Date(mutexAcquiredAt) : null,
    };
  }
}

export const cartographerScheduler = new CartographerScheduler();
