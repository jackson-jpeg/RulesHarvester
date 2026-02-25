import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import { createPostRateLimiter } from '../middleware/rateLimiter.js';
import { UpdateRuleRequestSchema } from '@rulesharvester/shared';
import type { z } from 'zod';

export const rulesRouter = Router();

// POST /rules rate limit: 20 requests per 10 minutes
const rulesPostLimiter = createPostRateLimiter('rules');
rulesRouter.post('*', rulesPostLimiter);

// Whitelist of allowed sort fields to prevent injection
const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'ruleCode', 'confidenceScore', 'name', 'triggerType'] as const;
type AllowedSortField = typeof ALLOWED_SORT_FIELDS[number];

function isAllowedSortField(field: string): field is AllowedSortField {
  return ALLOWED_SORT_FIELDS.includes(field as AllowedSortField);
}

// Get all rules with pagination and filtering
rulesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const requestedSortBy = (req.query.sortBy as string) || 'createdAt';
    const sortBy = isAllowedSortField(requestedSortBy) ? requestedSortBy : 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';
    const jurisdictionId = req.query.jurisdictionId as string | undefined;
    const triggerType = req.query.triggerType as string | undefined;
    const minConfidence = req.query.minConfidence ? parseFloat(req.query.minConfidence as string) : undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = {};

    if (jurisdictionId) {
      where.jurisdictionId = jurisdictionId;
    }
    if (triggerType) {
      where.triggerType = triggerType;
    }
    if (minConfidence !== undefined) {
      where.confidenceScore = { gte: minConfidence };
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { ruleCode: { contains: search } },
      ];
    }

    const [rules, total] = await Promise.all([
      prisma.rule.findMany({
        where,
        include: { jurisdiction: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.rule.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: rules,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);

// Get rule by ID
rulesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const rule = await prisma.rule.findUnique({
      where: { id },
      include: {
        jurisdiction: true,
        conflictsAsA: true,
        conflictsAsB: true,
      },
    });

    if (!rule) {
      throw new NotFoundError('Rule');
    }

    res.json({ success: true, data: rule });
  })
);

// Update rule
rulesRouter.patch(
  '/:id',
  validateBody(UpdateRuleRequestSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const rule = await prisma.rule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundError('Rule');
    }

    const updates: Record<string, unknown> = {};
    const body = req.body as z.infer<typeof UpdateRuleRequestSchema>;

    if (body.name !== undefined) updates.name = body.name;
    if (body.triggerType !== undefined) updates.triggerType = body.triggerType;
    if (body.deadlines !== undefined) updates.deadlines = JSON.stringify(body.deadlines);
    if (body.relatedRules !== undefined) updates.relatedRules = JSON.stringify(body.relatedRules);
    if (body.rawText !== undefined) updates.rawText = body.rawText;

    // Add audit entry
    let auditHistory: unknown[] = [];
    try {
      const rawHistory = rule.auditHistory;
      if (typeof rawHistory === 'string') {
        auditHistory = JSON.parse(rawHistory);
      } else if (Array.isArray(rawHistory)) {
        auditHistory = rawHistory;
      }
    } catch {
      console.error(`Failed to parse audit history for rule ${id}, starting fresh`);
      auditHistory = [];
    }
    auditHistory.push({
      id: `audit-${Date.now()}`,
      timestamp: new Date(),
      action: 'updated',
      user: 'system',
      hash: Buffer.from(JSON.stringify(updates)).toString('base64').slice(0, 16),
      metadata: { fields: Object.keys(updates) },
    });
    updates.auditHistory = JSON.stringify(auditHistory);

    const updated = await prisma.rule.update({
      where: { id },
      data: updates,
      include: { jurisdiction: true },
    });

    res.json({ success: true, data: updated });
  })
);

// Delete rule
rulesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const rule = await prisma.rule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundError('Rule');
    }

    await prisma.rule.delete({
      where: { id },
    });

    // Update jurisdiction rule count
    await prisma.jurisdiction.update({
      where: { id: rule.jurisdictionId },
      data: { ruleCount: { decrement: 1 } },
    });

    res.json({ success: true, message: 'Rule deleted' });
  })
);

// Get rules by jurisdiction (paginated)
rulesRouter.get(
  '/jurisdiction/:jurisdictionId',
  asyncHandler(async (req, res) => {
    const jurisdictionId = req.params.jurisdictionId as string;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);

    const [rules, total] = await Promise.all([
      prisma.rule.findMany({
        where: { jurisdictionId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.rule.count({ where: { jurisdictionId } }),
    ]);

    res.json({
      success: true,
      data: {
        items: rules,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);
