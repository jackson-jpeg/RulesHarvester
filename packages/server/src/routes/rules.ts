import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  UpdateRuleRequestSchema,
  PaginationQuerySchema,
  RuleFilterSchema,
} from '@rulesharvester/shared';
import { z } from 'zod';

export const rulesRouter = Router();

// Get all rules with pagination and filtering
rulesRouter.get(
  '/',
  validateQuery(PaginationQuerySchema.merge(RuleFilterSchema)),
  asyncHandler(async (req, res) => {
    const { page, pageSize, sortBy, sortOrder, jurisdictionId, triggerType, minConfidence, search } =
      req.query as z.infer<typeof PaginationQuerySchema> & z.infer<typeof RuleFilterSchema>;

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
        { name: { contains: search, mode: 'insensitive' } },
        { ruleCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rules, total] = await Promise.all([
      prisma.rule.findMany({
        where,
        include: { jurisdiction: true },
        orderBy: { [sortBy || 'createdAt']: sortOrder },
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
    const rule = await prisma.rule.findUnique({
      where: { id: req.params.id },
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
    const rule = await prisma.rule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule) {
      throw new NotFoundError('Rule');
    }

    const updates: Record<string, unknown> = {};
    const body = req.body as z.infer<typeof UpdateRuleRequestSchema>;

    if (body.name !== undefined) updates.name = body.name;
    if (body.triggerType !== undefined) updates.triggerType = body.triggerType;
    if (body.deadlines !== undefined) updates.deadlines = body.deadlines;
    if (body.relatedRules !== undefined) updates.relatedRules = body.relatedRules;
    if (body.rawText !== undefined) updates.rawText = body.rawText;

    // Add audit entry
    const auditHistory = (rule.auditHistory as unknown[]) || [];
    auditHistory.push({
      id: `audit-${Date.now()}`,
      timestamp: new Date(),
      action: 'updated',
      user: 'system',
      hash: Buffer.from(JSON.stringify(updates)).toString('base64').slice(0, 16),
      metadata: { fields: Object.keys(updates) },
    });
    updates.auditHistory = auditHistory;

    const updated = await prisma.rule.update({
      where: { id: req.params.id },
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
    const rule = await prisma.rule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule) {
      throw new NotFoundError('Rule');
    }

    await prisma.rule.delete({
      where: { id: req.params.id },
    });

    // Update jurisdiction rule count
    await prisma.jurisdiction.update({
      where: { id: rule.jurisdictionId },
      data: { ruleCount: { decrement: 1 } },
    });

    res.json({ success: true, message: 'Rule deleted' });
  })
);

// Get rules by jurisdiction
rulesRouter.get(
  '/jurisdiction/:jurisdictionId',
  asyncHandler(async (req, res) => {
    const rules = await prisma.rule.findMany({
      where: { jurisdictionId: req.params.jurisdictionId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: rules });
  })
);
