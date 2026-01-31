import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

export const conflictsRouter = Router();

// Get all conflicts with filtering
conflictsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [conflicts, total] = await Promise.all([
      prisma.ruleConflict.findMany({
        where,
        include: {
          ruleA: {
            select: { id: true, ruleCode: true, name: true, jurisdictionId: true },
          },
          ruleB: {
            select: { id: true, ruleCode: true, name: true, jurisdictionId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ruleConflict.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: conflicts,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);

// Get single conflict by ID
conflictsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const conflict = await prisma.ruleConflict.findUnique({
      where: { id },
      include: {
        ruleA: true,
        ruleB: true,
      },
    });

    if (!conflict) {
      throw new NotFoundError('Conflict');
    }

    res.json({ success: true, data: conflict });
  })
);

// Resolve conflict (accept AI recommendation)
conflictsRouter.post(
  '/:id/resolve',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { resolvedBy } = req.body;

    const conflict = await prisma.ruleConflict.findUnique({
      where: { id },
    });

    if (!conflict) {
      throw new NotFoundError('Conflict');
    }

    if (conflict.status !== 'UNRESOLVED') {
      throw new ValidationError('Conflict is already resolved');
    }

    const updated = await prisma.ruleConflict.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: resolvedBy || 'system',
      },
      include: {
        ruleA: {
          select: { id: true, ruleCode: true, name: true },
        },
        ruleB: {
          select: { id: true, ruleCode: true, name: true },
        },
      },
    });

    res.json({ success: true, data: updated });
  })
);

// Override conflict (manual resolution)
conflictsRouter.post(
  '/:id/override',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { resolvedBy, overrideNotes } = req.body;

    const conflict = await prisma.ruleConflict.findUnique({
      where: { id },
    });

    if (!conflict) {
      throw new NotFoundError('Conflict');
    }

    if (conflict.status !== 'UNRESOLVED') {
      throw new ValidationError('Conflict is already resolved');
    }

    // Update the AI recommendation with override notes if provided
    const aiResolutionRecommendation = overrideNotes
      ? `[MANUAL OVERRIDE] ${overrideNotes}\n\n[Original AI Recommendation] ${conflict.aiResolutionRecommendation}`
      : conflict.aiResolutionRecommendation;

    const updated = await prisma.ruleConflict.update({
      where: { id },
      data: {
        status: 'MANUAL_OVERRIDE',
        resolvedAt: new Date(),
        resolvedBy: resolvedBy || 'system',
        aiResolutionRecommendation,
      },
      include: {
        ruleA: {
          select: { id: true, ruleCode: true, name: true },
        },
        ruleB: {
          select: { id: true, ruleCode: true, name: true },
        },
      },
    });

    res.json({ success: true, data: updated });
  })
);

// Create a conflict manually (for testing or manual detection)
conflictsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { ruleAId, ruleBId, discrepancy, aiResolutionRecommendation } = req.body;

    if (!ruleAId || !ruleBId || !discrepancy) {
      throw new ValidationError('ruleAId, ruleBId, and discrepancy are required');
    }

    // Fetch both rules to get their codes
    const [ruleA, ruleB] = await Promise.all([
      prisma.rule.findUnique({ where: { id: ruleAId } }),
      prisma.rule.findUnique({ where: { id: ruleBId } }),
    ]);

    if (!ruleA) {
      throw new NotFoundError('Rule A');
    }
    if (!ruleB) {
      throw new NotFoundError('Rule B');
    }

    const conflict = await prisma.ruleConflict.create({
      data: {
        ruleAId,
        ruleBId,
        ruleACode: ruleA.ruleCode,
        ruleBCode: ruleB.ruleCode,
        discrepancy,
        aiResolutionRecommendation: aiResolutionRecommendation || 'Manual review required',
        status: 'UNRESOLVED',
      },
      include: {
        ruleA: {
          select: { id: true, ruleCode: true, name: true },
        },
        ruleB: {
          select: { id: true, ruleCode: true, name: true },
        },
      },
    });

    res.status(201).json({ success: true, data: conflict });
  })
);

// Delete a conflict
conflictsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const conflict = await prisma.ruleConflict.findUnique({
      where: { id },
    });

    if (!conflict) {
      throw new NotFoundError('Conflict');
    }

    await prisma.ruleConflict.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Conflict deleted' });
  })
);
