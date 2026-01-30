import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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

    const rules = await prisma.rule.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    });

    // Group by date
    const byDate = new Map<string, number>();
    for (const rule of rules) {
      const date = rule.createdAt.toISOString().split('T')[0];
      byDate.set(date, (byDate.get(date) || 0) + 1);
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
    const rules = await prisma.rule.findMany({
      where: { complexity: { not: null } },
      select: { complexity: true },
    });

    // Group by complexity level
    const distribution = {
      low: 0, // 1-3
      medium: 0, // 4-6
      high: 0, // 7-10
    };

    for (const rule of rules) {
      if (rule.complexity !== null) {
        if (rule.complexity <= 3) distribution.low++;
        else if (rule.complexity <= 6) distribution.medium++;
        else distribution.high++;
      }
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
