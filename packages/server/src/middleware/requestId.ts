import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware to add unique request ID to each request
 * The ID is available via req.requestId and X-Request-ID header
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header or generate a new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Attach to request object
  (req as Request & { requestId: string }).requestId = requestId;

  // Add to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
