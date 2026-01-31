import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';

export const bulkRouter = Router();

// Batch extraction for multiple jurisdictions
bulkRouter.post(
  '/extract',
  asyncHandler(async (req, res) => {
    const { jurisdictionIds, sourceUrl, rawText } = req.body;

    if (!Array.isArray(jurisdictionIds) || jurisdictionIds.length === 0) {
      throw new ValidationError('jurisdictionIds array is required');
    }

    if (jurisdictionIds.length > 50) {
      throw new ValidationError('Maximum 50 jurisdictions per batch');
    }

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
  asyncHandler(async (req, res) => {
    const { ruleIds, updates } = req.body;

    if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
      throw new ValidationError('ruleIds array is required');
    }

    if (ruleIds.length > 100) {
      throw new ValidationError('Maximum 100 rules per batch');
    }

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('updates object is required');
    }

    // Only allow certain fields to be bulk updated
    const allowedFields = ['triggerType', 'confidenceScore', 'complexity'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError(`No valid fields to update. Allowed fields: ${allowedFields.join(', ')}`);
    }

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
  asyncHandler(async (req, res) => {
    const { jurisdictionIds, status } = req.body;

    if (!Array.isArray(jurisdictionIds) || jurisdictionIds.length === 0) {
      throw new ValidationError('jurisdictionIds array is required');
    }

    if (!status) {
      throw new ValidationError('status is required');
    }

    const validStatuses = ['IDLE', 'SEARCHING', 'HARVESTING', 'SYNCED', 'FAILED', 'UPDATING'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

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
  asyncHandler(async (req, res) => {
    const { ruleIds } = req.body;

    if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
      throw new ValidationError('ruleIds array is required');
    }

    if (ruleIds.length > 100) {
      throw new ValidationError('Maximum 100 rules per batch delete');
    }

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
