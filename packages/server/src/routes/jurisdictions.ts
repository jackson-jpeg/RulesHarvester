import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { getScrapingStrategy } from '../services/scraper/aiScraper.js';
import { watchtowerService } from '../services/watchtower/watchtowerService.js';

export const jurisdictionsRouter = Router();

// Get all jurisdictions with optional filtering
jurisdictionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 200);
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const [jurisdictions, total] = await Promise.all([
      prisma.jurisdiction.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.jurisdiction.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: jurisdictions,
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
    const id = req.params.id as string;
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        rules: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    res.json({
      success: true,
      data: jurisdiction,
    });
  })
);

// Update jurisdiction status
jurisdictionsRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { status } = req.body;

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    const updated = await prisma.jurisdiction.update({
      where: { id },
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
    const id = req.params.id as string;
    const { dna } = req.body;

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    const updated = await prisma.jurisdiction.update({
      where: { id },
      data: { dna: JSON.stringify(dna) },
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
      }),
      prisma.jurisdiction.findMany({
        where: { type: 'FEDERAL_DISTRICT' },
        orderBy: { name: 'asc' },
      }),
      prisma.jurisdiction.findMany({
        where: { type: 'STATE' },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        federalCircuits: circuits,
        federalDistricts: districts,
        states: states,
      },
    });
  })
);

// Get circuit with its districts
jurisdictionsRouter.get(
  '/circuit/:id/districts',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const circuit = await prisma.jurisdiction.findUnique({
      where: { id, type: 'FEDERAL_CIRCUIT' },
      include: {
        children: {
          orderBy: { name: 'asc' },
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
        districts: circuit.children,
      },
    });
  })
);

// Update sync settings
jurisdictionsRouter.patch(
  '/:id/sync-settings',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { autoSyncEnabled, syncFrequency } = req.body;

    const jurisdiction = await prisma.jurisdiction.findUnique({ where: { id } });
    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    if (syncFrequency && !['DAILY', 'WEEKLY', 'MANUAL_ONLY'].includes(syncFrequency)) {
      return res.status(400).json({ success: false, error: 'Invalid syncFrequency' });
    }

    const updated = await prisma.jurisdiction.update({
      where: { id },
      data: {
        ...(autoSyncEnabled !== undefined && { autoSyncEnabled }),
        ...(syncFrequency && { syncFrequency }),
      },
    });

    res.json({ success: true, data: updated });
  })
);

// Trigger AI discovery of scraper selectors
jurisdictionsRouter.post(
  '/:id/discover',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { forceRediscovery = false } = req.body;

    const jurisdiction = await prisma.jurisdiction.findUnique({ where: { id } });
    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    if (!jurisdiction.courtWebsite) {
      return res.status(400).json({ success: false, error: 'No court website configured' });
    }

    // Clear cached config if forcing rediscovery
    if (forceRediscovery && jurisdiction.scraperConfig) {
      await prisma.jurisdiction.update({
        where: { id },
        data: { scraperConfig: Prisma.DbNull },
      });
    }

    // Trigger discovery
    const config = await getScrapingStrategy(jurisdiction.courtWebsite, id);

    res.json({
      success: true,
      data: {
        status: forceRediscovery ? 'rediscovered' : 'discovered',
        config,
      },
    });
  })
);

// Check jurisdiction for updates (Watchtower)
jurisdictionsRouter.post(
  '/:id/check-updates',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const jurisdiction = await prisma.jurisdiction.findUnique({ where: { id } });
    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    if (!jurisdiction.courtWebsite) {
      return res.status(400).json({ success: false, error: 'No court website configured' });
    }

    const result = await watchtowerService.checkForUpdates(id);

    res.json({
      success: true,
      data: result,
    });
  })
);

// Run Watchtower scan on all auto-sync jurisdictions
jurisdictionsRouter.post(
  '/watchtower/scan',
  asyncHandler(async (_req, res) => {
    const results = await watchtowerService.runScheduledChecks();

    res.json({
      success: true,
      data: {
        totalChecked: results.length,
        changesDetected: results.filter(r => r.hasChanges).length,
        relevantChanges: results.filter(r => r.relevantUpdate).length,
        results,
      },
    });
  })
);
