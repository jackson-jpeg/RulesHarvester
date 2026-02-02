import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import {
  BulkExtractRequestSchema,
  BulkRulesUpdateSchema,
  BulkStatusUpdateSchema,
  BulkDeleteRulesSchema,
} from '@rulesharvester/shared';

export const bulkRouter = Router();

// Batch extraction for multiple jurisdictions
bulkRouter.post(
  '/extract',
  validateBody(BulkExtractRequestSchema),
  asyncHandler(async (req, res) => {
    const { jurisdictionIds, sourceUrl, rawText } = req.body;

    // Verify all jurisdictions exist
    const jurisdictions = await prisma.jurisdiction.findMany({
      where: { id: { in: jurisdictionIds } },
    });

    if (jurisdictions.length !== jurisdictionIds.length) {
      const foundIds = new Set(jurisdictions.map((j) => j.id));
      const missingIds = jurisdictionIds.filter((id: string) => !foundIds.has(id));
      throw new ValidationError(`Jurisdictions not found: ${missingIds.join(', ')}`);
    }

    // Create extraction jobs for each jurisdiction
    const jobs = await prisma.extractionJob.createManyAndReturn({
      data: jurisdictions.map((j) => ({
        jurisdictionId: j.id,
        jurisdictionCode: j.code,
        sourceUrl: sourceUrl || 'batch-extraction',
        rawText: rawText || null,
        status: 'PENDING',
        progress: 0,
        currentStep: 'Queued for batch extraction',
      })),
    });

    // Update jurisdiction statuses to SEARCHING
    await prisma.jurisdiction.updateMany({
      where: { id: { in: jurisdictionIds } },
      data: { status: 'SEARCHING' },
    });

    res.status(201).json({
      success: true,
      data: {
        jobsCreated: jobs.length,
        jobs: jobs.map((j) => ({ id: j.id, jurisdictionId: j.jurisdictionId })),
      },
    });
  })
);

// Update multiple rules at once
bulkRouter.patch(
  '/rules',
  validateBody(BulkRulesUpdateSchema),
  asyncHandler(async (req, res) => {
    const { ruleIds, updates } = req.body;

    // Build update data from validated updates
    const updateData: Record<string, unknown> = {};
    if (updates.triggerType !== undefined) updateData.triggerType = updates.triggerType;
    if (updates.confidenceScore !== undefined) updateData.confidenceScore = updates.confidenceScore;
    if (updates.complexity !== undefined) updateData.complexity = updates.complexity;

    // Verify all rules exist
    const existingRules = await prisma.rule.findMany({
      where: { id: { in: ruleIds } },
      select: { id: true },
    });

    if (existingRules.length !== ruleIds.length) {
      const foundIds = new Set(existingRules.map((r) => r.id));
      const missingIds = ruleIds.filter((id: string) => !foundIds.has(id));
      throw new ValidationError(`Rules not found: ${missingIds.slice(0, 5).join(', ')}${missingIds.length > 5 ? '...' : ''}`);
    }

    // Perform bulk update
    const result = await prisma.rule.updateMany({
      where: { id: { in: ruleIds } },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        updatedCount: result.count,
        fields: Object.keys(updateData),
      },
    });
  })
);

// Mass status update for jurisdictions
bulkRouter.patch(
  '/jurisdictions/status',
  validateBody(BulkStatusUpdateSchema),
  asyncHandler(async (req, res) => {
    const { jurisdictionIds, status } = req.body;

    // Perform bulk update
    const result = await prisma.jurisdiction.updateMany({
      where: { id: { in: jurisdictionIds } },
      data: { status },
    });

    res.json({
      success: true,
      data: {
        updatedCount: result.count,
        newStatus: status,
      },
    });
  })
);

// Bulk delete rules
bulkRouter.delete(
  '/rules',
  validateBody(BulkDeleteRulesSchema),
  asyncHandler(async (req, res) => {
    const { ruleIds } = req.body;

    // Get the rules to find their jurisdictions for count update
    const rules = await prisma.rule.findMany({
      where: { id: { in: ruleIds } },
      select: { id: true, jurisdictionId: true },
    });

    if (rules.length === 0) {
      throw new ValidationError('No matching rules found');
    }

    // Count rules per jurisdiction
    const jurisdictionCounts = new Map<string, number>();
    for (const rule of rules) {
      const count = jurisdictionCounts.get(rule.jurisdictionId) || 0;
      jurisdictionCounts.set(rule.jurisdictionId, count + 1);
    }

    // Delete rules
    const deleteResult = await prisma.rule.deleteMany({
      where: { id: { in: ruleIds } },
    });

    // Update jurisdiction rule counts
    for (const [jurisdictionId, count] of jurisdictionCounts) {
      await prisma.jurisdiction.update({
        where: { id: jurisdictionId },
        data: { ruleCount: { decrement: count } },
      });
    }

    res.json({
      success: true,
      data: {
        deletedCount: deleteResult.count,
      },
    });
  })
);
