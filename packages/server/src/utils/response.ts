import type { Response } from 'express';

/**
 * Send a successful JSON response
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Send a successful JSON response with a message
 */
export function sendSuccessMessage(res: Response, message: string, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    message,
  });
}

/**
 * Send an error JSON response
 */
export function sendError(res: Response, statusCode: number, message: string, details?: unknown): void {
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(details ? { details } : {}),
  });
}

/**
 * Send a 400 Bad Request response
 */
export function sendBadRequest(res: Response, message: string, details?: unknown): void {
  sendError(res, 400, message, details);
}

/**
 * Send a 404 Not Found response
 */
export function sendNotFound(res: Response, resource = 'Resource'): void {
  sendError(res, 404, `${resource} not found`);
}

/**
 * Send a 500 Internal Server Error response
 */
export function sendServerError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Internal server error';
  sendError(res, 500, message);
}
