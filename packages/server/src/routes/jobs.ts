import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import { CreateExtractionJobRequestSchema } from '@rulesharvester/shared';
import { extractionQueue } from '../services/queue/extractionQueue.js';
import type { z } from 'zod';

export const jobsRouter = Router();

// Get all jobs
jobsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const jobs = await prisma.extractionJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        jurisdiction: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    res.json({ success: true, data: jobs });
  })
);

// Get job by ID
jobsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const job = await prisma.extractionJob.findUnique({
      where: { id: req.params.id },
      include: { jurisdiction: true },
    });

    if (!job) {
      throw new NotFoundError('Job');
    }

    res.json({ success: true, data: job });
  })
);

// Create new extraction job
jobsRouter.post(
  '/',
  validateBody(CreateExtractionJobRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof CreateExtractionJobRequestSchema>;

    // Verify jurisdiction exists
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: body.jurisdictionId },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    // Check for existing pending/processing job for this jurisdiction
    const existingJob = await prisma.extractionJob.findFirst({
      where: {
        jurisdictionId: body.jurisdictionId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (existingJob) {
      throw new ValidationError('An extraction job is already in progress for this jurisdiction');
    }

    // Create job record
    const job = await prisma.extractionJob.create({
      data: {
        jurisdictionId: body.jurisdictionId,
        jurisdictionCode: jurisdiction.code,
        sourceUrl: body.sourceUrl,
        rawText: body.rawText,
        status: 'PENDING',
        progress: 0,
        currentStep: 'Queued for processing',
      },
    });

    // Add to queue
    await extractionQueue.add('extract', {
      jobId: job.id,
      jurisdictionId: body.jurisdictionId,
      jurisdictionCode: jurisdiction.code,
      sourceUrl: body.sourceUrl,
      rawText: body.rawText,
    });

    res.status(201).json({ success: true, data: job });
  })
);

// Cancel job
jobsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const job = await prisma.extractionJob.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      throw new NotFoundError('Job');
    }

    if (job.status !== 'PENDING' && job.status !== 'PROCESSING') {
      throw new ValidationError('Only pending or processing jobs can be cancelled');
    }

    await prisma.extractionJob.update({
      where: { id: req.params.id },
      data: {
        status: 'FAILED',
        error: 'Cancelled by user',
        progress: 0,
      },
    });

    res.json({ success: true, message: 'Job cancelled' });
  })
);

// Retry failed job
jobsRouter.post(
  '/:id/retry',
  asyncHandler(async (req, res) => {
    const job = await prisma.extractionJob.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      throw new NotFoundError('Job');
    }

    if (job.status !== 'FAILED') {
      throw new ValidationError('Only failed jobs can be retried');
    }

    // Reset job state
    await prisma.extractionJob.update({
      where: { id: req.params.id },
      data: {
        status: 'PENDING',
        progress: 0,
        error: null,
        currentStep: 'Queued for retry',
      },
    });

    // Add back to queue
    await extractionQueue.add('extract', {
      jobId: job.id,
      jurisdictionId: job.jurisdictionId,
      jurisdictionCode: job.jurisdictionCode,
      sourceUrl: job.sourceUrl,
      rawText: job.rawText,
    });

    res.json({ success: true, message: 'Job queued for retry' });
  })
);
