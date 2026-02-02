import { Router } from 'express';
import { z } from 'zod';
import { InboxItemType, InboxStatus } from '@rulesharvester/shared';
import { inboxService } from '../services/inbox/inboxService.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

// Validation schemas
const GetItemsQuerySchema = z.object({
  type: z.nativeEnum(InboxItemType).optional(),
  status: z.nativeEnum(InboxStatus).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'confidence']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const ApproveRejectBodySchema = z.object({
  reason: z.string().optional(),
});

const BulkApproveBodySchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

const BulkRejectBodySchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  reason: z.string().optional(),
});

/**
 * GET /api/inbox
 * List inbox items with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const query = GetItemsQuerySchema.parse(req.query);

    const result = await inboxService.getItems(
      {
        type: query.type,
        status: query.status,
      },
      {
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      }
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error('Failed to get inbox items:', error);
    if (error instanceof z.ZodError) {
      sendError(res, 400, `Invalid query parameters: ${error.message}`);
    } else {
      sendError(res, 500, 'Failed to get inbox items');
    }
  }
});

/**
 * GET /api/inbox/stats
 * Get inbox statistics
 */
router.get('/stats', async (_req, res) => {
  try {
    const stats = await inboxService.getStats();
    sendSuccess(res, stats);
  } catch (error) {
    console.error('Failed to get inbox stats:', error);
    sendError(res, 500, 'Failed to get inbox statistics');
  }
});

/**
 * GET /api/inbox/:id
 * Get a single inbox item
 */
router.get('/:id', async (req, res) => {
  try {
    const item = await inboxService.getItem(req.params.id);

    if (!item) {
      sendError(res, 404, 'Inbox item not found');
      return;
    }

    sendSuccess(res, item);
  } catch (error) {
    console.error(`Failed to get inbox item ${req.params.id}:`, error);
    sendError(res, 500, 'Failed to get inbox item');
  }
});

/**
 * POST /api/inbox/:id/approve
 * Approve an inbox item
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const item = await inboxService.approveItem(req.params.id, 'api-user');
    sendSuccess(res, item);
  } catch (error) {
    console.error(`Failed to approve inbox item ${req.params.id}:`, error);
    if (error instanceof Error) {
      if (error.message === 'Inbox item not found') {
        sendError(res, 404, error.message);
        return;
      }
      if (error.message === 'Inbox item is not pending') {
        sendError(res, 400, error.message);
        return;
      }
    }
    sendError(res, 500, 'Failed to approve inbox item');
  }
});

/**
 * POST /api/inbox/:id/reject
 * Reject an inbox item
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const body = ApproveRejectBodySchema.parse(req.body);
    const item = await inboxService.rejectItem(
      req.params.id,
      body.reason,
      'api-user'
    );
    sendSuccess(res, item);
  } catch (error) {
    console.error(`Failed to reject inbox item ${req.params.id}:`, error);
    if (error instanceof z.ZodError) {
      sendError(res, 400, `Invalid request body: ${error.message}`);
      return;
    }
    if (error instanceof Error) {
      if (error.message === 'Inbox item not found') {
        sendError(res, 404, error.message);
        return;
      }
      if (error.message === 'Inbox item is not pending') {
        sendError(res, 400, error.message);
        return;
      }
    }
    sendError(res, 500, 'Failed to reject inbox item');
  }
});

/**
 * POST /api/inbox/:id/defer
 * Defer an inbox item for later review
 */
router.post('/:id/defer', async (req, res) => {
  try {
    const item = await inboxService.deferItem(req.params.id, 'api-user');
    sendSuccess(res, item);
  } catch (error) {
    console.error(`Failed to defer inbox item ${req.params.id}:`, error);
    if (error instanceof Error) {
      if (error.message === 'Inbox item not found') {
        sendError(res, 404, error.message);
        return;
      }
      if (error.message === 'Inbox item is not pending') {
        sendError(res, 400, error.message);
        return;
      }
    }
    sendError(res, 500, 'Failed to defer inbox item');
  }
});

/**
 * POST /api/inbox/bulk-approve
 * Bulk approve multiple inbox items
 */
router.post('/bulk-approve', async (req, res) => {
  try {
    const body = BulkApproveBodySchema.parse(req.body);
    const result = await inboxService.bulkApprove(body.ids, 'api-user');
    sendSuccess(res, result);
  } catch (error) {
    console.error('Failed to bulk approve inbox items:', error);
    if (error instanceof z.ZodError) {
      sendError(res, 400, `Invalid request body: ${error.message}`);
    } else {
      sendError(res, 500, 'Failed to bulk approve inbox items');
    }
  }
});

/**
 * POST /api/inbox/bulk-reject
 * Bulk reject multiple inbox items
 */
router.post('/bulk-reject', async (req, res) => {
  try {
    const body = BulkRejectBodySchema.parse(req.body);
    const result = await inboxService.bulkReject(
      body.ids,
      body.reason,
      'api-user'
    );
    sendSuccess(res, result);
  } catch (error) {
    console.error('Failed to bulk reject inbox items:', error);
    if (error instanceof z.ZodError) {
      sendError(res, 400, `Invalid request body: ${error.message}`);
    } else {
      sendError(res, 500, 'Failed to bulk reject inbox items');
    }
  }
});

export default router;
