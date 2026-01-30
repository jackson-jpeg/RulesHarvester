import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { validateQuery } from '../middleware/validate.js';
import { JurisdictionFilterSchema, PaginationQuerySchema } from '@rulesharvester/shared';
import type { z } from 'zod';

export const jurisdictionsRouter = Router();

// Get all jurisdictions with optional filtering
jurisdictionsRouter.get(
  '/',
  validateQuery(PaginationQuerySchema.merge(JurisdictionFilterSchema)),
  asyncHandler(async (req, res) => {
    const { page, pageSize, type, status, search } = req.query as z.infer<
      typeof PaginationQuerySchema
    > &
      z.infer<typeof JurisdictionFilterSchema>;

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [jurisdictions, total] = await Promise.all([
      prisma.jurisdiction.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { rules: true },
          },
        },
      }),
      prisma.jurisdiction.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: jurisdictions.map((j) => ({
          ...j,
          ruleCount: j._count.rules,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);

// Get jurisdiction by ID
jurisdictionsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: req.params.id },
      include: {
        parent: true,
        children: true,
        rules: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { rules: true },
        },
      },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    res.json({
      success: true,
      data: {
        ...jurisdiction,
        ruleCount: jurisdiction._count.rules,
      },
    });
  })
);

// Update jurisdiction status
jurisdictionsRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: req.params.id },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    const updated = await prisma.jurisdiction.update({
      where: { id: req.params.id },
      data: {
        status,
        lastSyncedAt: status === 'SYNCED' ? new Date() : undefined,
      },
    });

    res.json({ success: true, data: updated });
  })
);

// Update jurisdiction DNA
jurisdictionsRouter.patch(
  '/:id/dna',
  asyncHandler(async (req, res) => {
    const { dna } = req.body;

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: req.params.id },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    const updated = await prisma.jurisdiction.update({
      where: { id: req.params.id },
      data: { dna },
    });

    res.json({ success: true, data: updated });
  })
);

// Get jurisdictions grouped by type
jurisdictionsRouter.get(
  '/grouped/by-type',
  asyncHandler(async (_req, res) => {
    const [circuits, districts, states] = await Promise.all([
      prisma.jurisdiction.findMany({
        where: { type: 'FEDERAL_CIRCUIT' },
        orderBy: { name: 'asc' },
        include: { _count: { select: { rules: true } } },
      }),
      prisma.jurisdiction.findMany({
        where: { type: 'FEDERAL_DISTRICT' },
        orderBy: { name: 'asc' },
        include: { _count: { select: { rules: true } } },
      }),
      prisma.jurisdiction.findMany({
        where: { type: 'STATE' },
        orderBy: { name: 'asc' },
        include: { _count: { select: { rules: true } } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        federalCircuits: circuits.map((j) => ({ ...j, ruleCount: j._count.rules })),
        federalDistricts: districts.map((j) => ({ ...j, ruleCount: j._count.rules })),
        states: states.map((j) => ({ ...j, ruleCount: j._count.rules })),
      },
    });
  })
);

// Get circuit with its districts
jurisdictionsRouter.get(
  '/circuit/:id/districts',
  asyncHandler(async (req, res) => {
    const circuit = await prisma.jurisdiction.findUnique({
      where: { id: req.params.id, type: 'FEDERAL_CIRCUIT' },
      include: {
        children: {
          orderBy: { name: 'asc' },
          include: { _count: { select: { rules: true } } },
        },
      },
    });

    if (!circuit) {
      throw new NotFoundError('Circuit');
    }

    res.json({
      success: true,
      data: {
        circuit,
        districts: circuit.children.map((d) => ({ ...d, ruleCount: d._count.rules })),
      },
    });
  })
);
