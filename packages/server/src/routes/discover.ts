import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

export const discoverRouter = Router();

// Get discovery candidates for a jurisdiction
discoverRouter.get(
  '/:jurisdictionId',
  asyncHandler(async (req, res) => {
    const candidates = await prisma.discoveryCandidate.findMany({
      where: { jurisdictionId: req.params.jurisdictionId },
      orderBy: { relevanceScore: 'desc' },
    });

    res.json({ success: true, data: candidates });
  })
);

// Create discovery candidate manually
discoverRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { jurisdictionId, ruleId, snippet, sourceUrl, relevanceScore } = req.body;

    if (!jurisdictionId || !ruleId || !sourceUrl) {
      throw new ValidationError('jurisdictionId, ruleId, and sourceUrl are required');
    }

    // Verify jurisdiction exists
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: jurisdictionId },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    const candidate = await prisma.discoveryCandidate.create({
      data: {
        jurisdictionId,
        jurisdiction: jurisdiction.name,
        ruleId,
        snippet: snippet || '',
        sourceUrl,
        relevanceScore: relevanceScore || 50,
        status: 'DISCOVERED',
      },
    });

    res.status(201).json({ success: true, data: candidate });
  })
);

// Acquire a discovered candidate (trigger extraction)
discoverRouter.post(
  '/:id/acquire',
  asyncHandler(async (req, res) => {
    const candidate = await prisma.discoveryCandidate.findUnique({
      where: { id: req.params.id },
    });

    if (!candidate) {
      throw new NotFoundError('Discovery candidate');
    }

    if (candidate.status === 'ACQUIRED') {
      throw new ValidationError('Candidate already acquired');
    }

    // Update status to processing
    await prisma.discoveryCandidate.update({
      where: { id: req.params.id },
      data: { status: 'PROCESSING' },
    });

    // Create extraction job
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: candidate.jurisdictionId },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    const job = await prisma.extractionJob.create({
      data: {
        jurisdictionId: candidate.jurisdictionId,
        jurisdictionCode: jurisdiction.code,
        sourceUrl: candidate.sourceUrl,
        status: 'PENDING',
        progress: 0,
        currentStep: 'Queued for extraction',
      },
    });

    // Update candidate with reference
    await prisma.discoveryCandidate.update({
      where: { id: req.params.id },
      data: { status: 'PROCESSING' },
    });

    res.json({ success: true, data: { candidate, job } });
  })
);

// Reject a discovery candidate
discoverRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const candidate = await prisma.discoveryCandidate.findUnique({
      where: { id: req.params.id },
    });

    if (!candidate) {
      throw new NotFoundError('Discovery candidate');
    }

    await prisma.discoveryCandidate.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
    });

    res.json({ success: true, message: 'Candidate rejected' });
  })
);

// Batch acquire multiple candidates
discoverRouter.post(
  '/batch/acquire',
  asyncHandler(async (req, res) => {
    const { candidateIds } = req.body;

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      throw new ValidationError('candidateIds array is required');
    }

    const results = [];

    for (const id of candidateIds) {
      const candidate = await prisma.discoveryCandidate.findUnique({
        where: { id },
      });

      if (candidate && candidate.status === 'DISCOVERED') {
        await prisma.discoveryCandidate.update({
          where: { id },
          data: { status: 'PROCESSING' },
        });
        results.push({ id, status: 'queued' });
      } else {
        results.push({ id, status: 'skipped' });
      }
    }

    res.json({ success: true, data: results });
  })
);
