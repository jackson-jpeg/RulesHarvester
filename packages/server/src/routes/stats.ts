import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getQueueStats } from '../services/queue/bullmqQueue.js';

export const statsRouter = Router();

// Get dashboard statistics
statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [
      totalRules,
      totalJurisdictions,
      syncedJurisdictions,
      pendingJobs,
      unresolvedConflicts,
      avgConfidence,
      recentJobs,
      rulesByType,
      jurisdictionsByStatus,
    ] = await Promise.all([
      prisma.rule.count(),
      prisma.jurisdiction.count(),
      prisma.jurisdiction.count({ where: { status: 'SYNCED' } }),
      prisma.extractionJob.count({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      }),
      prisma.ruleConflict.count({ where: { status: 'UNRESOLVED' } }),
      prisma.rule.aggregate({ _avg: { confidenceScore: true } }),
      prisma.extractionJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          jurisdiction: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.rule.groupBy({
        by: ['triggerType'],
        _count: true,
      }),
      prisma.jurisdiction.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalRules,
        totalJurisdictions,
        syncedJurisdictions,
        pendingJobs,
        unresolvedConflicts,
        avgConfidenceScore: avgConfidence._avg.confidenceScore || 0,
        recentExtractions: recentJobs,
        rulesByTriggerType: rulesByType.map((r) => ({
          triggerType: r.triggerType,
          count: r._count,
        })),
        jurisdictionsByStatus: jurisdictionsByStatus.map((j) => ({
          status: j.status,
          count: j._count,
        })),
      },
    });
  })
);

// Get extraction velocity (rules extracted per day for last 30 days)
statsRouter.get(
  '/velocity',
  asyncHandler(async (_req, res) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Use raw SQL for efficient date-based grouping
    const dailyCounts = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM "Rule"
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    // Convert to map for easy lookup
    const byDate = new Map<string, number>();
    for (const row of dailyCounts) {
      byDate.set(row.date, Number(row.count));
    }

    // Fill in missing dates with zeros
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: byDate.get(dateStr) || 0,
      });
    }

    res.json({ success: true, data: result });
  })
);

// Get complexity distribution
statsRouter.get(
  '/complexity',
  asyncHandler(async (_req, res) => {
    // Use raw SQL for efficient complexity bucketing
    const complexityCounts = await prisma.$queryRaw<{ level: string; count: bigint }[]>`
      SELECT
        CASE
          WHEN complexity <= 3 THEN 'low'
          WHEN complexity <= 6 THEN 'medium'
          ELSE 'high'
        END as level,
        COUNT(*) as count
      FROM "Rule"
      WHERE complexity IS NOT NULL
      GROUP BY level
    `;

    // Convert to distribution object
    const distribution = {
      low: 0,
      medium: 0,
      high: 0,
    };

    for (const row of complexityCounts) {
      if (row.level === 'low') distribution.low = Number(row.count);
      else if (row.level === 'medium') distribution.medium = Number(row.count);
      else if (row.level === 'high') distribution.high = Number(row.count);
    }

    res.json({ success: true, data: distribution });
  })
);

// Get system logs
statsRouter.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const logs = await prisma.systemLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: logs });
  })
);

// Create system log
statsRouter.post(
  '/logs',
  asyncHandler(async (req, res) => {
    const { message, type, metadata } = req.body;

    const log = await prisma.systemLog.create({
      data: {
        message,
        type: type || 'INFO',
        metadata,
      },
    });

    res.status(201).json({ success: true, data: log });
  })
);

// Get queue statistics
statsRouter.get(
  '/queue',
  asyncHandler(async (_req, res) => {
    const queueStats = await getQueueStats();

    res.json({
      success: true,
      data: {
        ...queueStats,
        redisConnected: queueStats.waiting !== 0 || queueStats.active !== 0 ||
                        queueStats.completed !== 0 || queueStats.failed !== 0 ||
                        process.env.REDIS_URL !== undefined,
      },
    });
  })
);

// Get system status
statsRouter.get(
  '/system',
  asyncHandler(async (_req, res) => {
    const [
      totalJurisdictions,
      autoSyncEnabled,
      withScraperConfig,
      recentWatchtowerScans,
    ] = await Promise.all([
      prisma.jurisdiction.count(),
      prisma.jurisdiction.count({ where: { autoSyncEnabled: true } }),
      prisma.jurisdiction.count({ where: { scraperConfig: { not: Prisma.DbNull } } }),
      prisma.systemLog.count({
        where: {
          message: { startsWith: 'Watchtower scan' },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const queueStats = await getQueueStats();

    res.json({
      success: true,
      data: {
        database: {
          connected: true,
          provider: 'postgresql',
        },
        redis: {
          connected: !!process.env.REDIS_URL,
          url: process.env.REDIS_URL ? '***configured***' : 'not configured',
        },
        queue: queueStats,
        cartographer: {
          jurisdictionsWithConfig: withScraperConfig,
          totalJurisdictions,
          coverage: totalJurisdictions > 0
            ? Math.round((withScraperConfig / totalJurisdictions) * 100)
            : 0,
        },
        watchtower: {
          autoSyncEnabled,
          recentScans: recentWatchtowerScans,
        },
        environment: process.env.NODE_ENV || 'development',
        version: '2.0.0',
      },
    });
  })
);
