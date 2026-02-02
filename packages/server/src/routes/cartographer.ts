import { Router } from 'express';
import { cartographerService } from '../services/cartographer/cartographerService.js';
import {
  CartographerDiscoverRequestSchema,
  JurisdictionApprovalRequestSchema,
  JurisdictionRejectionRequestSchema,
  PaginationQuerySchema,
} from '@rulesharvester/shared';
import { sendSuccess, sendError } from '../utils/response.js';
import { sseManager } from '../services/sse/sseManager.js';
import { prisma } from '../index.js';

export const cartographerRouter = Router();

/**
 * POST /api/cartographer/discover
 * Trigger jurisdiction discovery (runs in background)
 */
cartographerRouter.post('/discover', async (req, res) => {
  try {
    const parseResult = CartographerDiscoverRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 400, `Invalid request: ${parseResult.error.message}`);
    }

    const { jurisdictionTypes, maxResults, customQueries } = parseResult.data;

    // Run discovery in background
    cartographerService
      .discoverJurisdictions({ jurisdictionTypes, maxResults, customQueries })
      .catch(async (error) => {
        console.error('Cartographer: Background discovery failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Send SSE notification for discovery failure
        sseManager.sendCartographerDiscoveryFailed(errorMessage);
        // Log the error to SystemLog for audit trail
        try {
          await prisma.systemLog.create({
            data: {
              message: `Cartographer discovery failed: ${errorMessage}`,
              type: 'ERROR',
              metadata: { jurisdictionTypes, maxResults, error: String(error) },
            },
          });
        } catch (logError) {
          console.error('Failed to log cartographer error:', logError);
        }
      });

    return sendSuccess(res, { message: 'Discovery started' });
  } catch (error) {
    console.error('Cartographer: Failed to start discovery:', error);
    return sendError(
      res,
      500,
      error instanceof Error ? error.message : 'Failed to start discovery'
    );
  }
});

/**
 * GET /api/cartographer/queue
 * List discovered jurisdictions pending approval
 */
cartographerRouter.get('/queue', async (req, res) => {
  try {
    const paginationResult = PaginationQuerySchema.safeParse(req.query);
    const pagination = paginationResult.success
      ? paginationResult.data
      : { page: 1, pageSize: 20, sortOrder: 'desc' as const };

    const sortBy = (req.query.sortBy as 'discoveryScore' | 'discoveredAt') || 'discoveryScore';

    const queue = await cartographerService.getDiscoveryQueue({
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder: pagination.sortOrder,
    });

    return sendSuccess(res, queue);
  } catch (error) {
    console.error('Cartographer: Failed to get queue:', error);
    return sendError(
      res,
      500,
      error instanceof Error ? error.message : 'Failed to get discovery queue'
    );
  }
});

/**
 * POST /api/cartographer/approve/:id
 * Approve a discovered jurisdiction
 */
cartographerRouter.post('/approve/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const parseResult = JurisdictionApprovalRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 400, `Invalid request: ${parseResult.error.message}`);
    }

    await cartographerService.approveJurisdiction(id, parseResult.data);
    return sendSuccess(res, { message: 'Jurisdiction approved' });
  } catch (error) {
    console.error('Cartographer: Failed to approve jurisdiction:', error);
    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    return sendError(
      res,
      statusCode,
      error instanceof Error ? error.message : 'Failed to approve jurisdiction'
    );
  }
});

/**
 * POST /api/cartographer/reject/:id
 * Reject a discovered jurisdiction
 */
cartographerRouter.post('/reject/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const parseResult = JurisdictionRejectionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 400, `Invalid request: ${parseResult.error.message}`);
    }

    await cartographerService.rejectJurisdiction(id, parseResult.data.reason);
    return sendSuccess(res, { message: 'Jurisdiction rejected' });
  } catch (error) {
    console.error('Cartographer: Failed to reject jurisdiction:', error);
    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    return sendError(
      res,
      statusCode,
      error instanceof Error ? error.message : 'Failed to reject jurisdiction'
    );
  }
});

/**
 * GET /api/cartographer/status
 * Get Cartographer service status
 */
cartographerRouter.get('/status', async (_req, res) => {
  try {
    const status = await cartographerService.getStatus();
    return sendSuccess(res, status);
  } catch (error) {
    console.error('Cartographer: Failed to get status:', error);
    return sendError(
      res,
      500,
      error instanceof Error ? error.message : 'Failed to get status'
    );
  }
});

/**
 * POST /api/cartographer/bulk-approve
 * Approve multiple jurisdictions at once
 */
cartographerRouter.post('/bulk-approve', async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 400, 'ids array is required');
    }

    const result = await cartographerService.bulkApprove(ids);
    return sendSuccess(res, result);
  } catch (error) {
    console.error('Cartographer: Failed to bulk approve:', error);
    return sendError(
      res,
      500,
      error instanceof Error ? error.message : 'Failed to bulk approve'
    );
  }
});
