import type { Request } from 'express';

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Parse pagination parameters from request query
 * @param req Express request object
 * @param allowedSortFields Array of allowed sort field names (for injection prevention)
 * @param defaultSortBy Default field to sort by
 * @returns Parsed pagination parameters
 */
export function parsePaginationParams(
  req: Request,
  allowedSortFields: readonly string[],
  defaultSortBy = 'createdAt'
): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(Math.max(1, parseInt(req.query.pageSize as string) || 20), 100);
  const requestedSortBy = (req.query.sortBy as string) || defaultSortBy;
  const sortBy = allowedSortFields.includes(requestedSortBy) ? requestedSortBy : defaultSortBy;
  const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

  const cursor = validateCursor(req.query.cursor as string);

  return { page, pageSize, sortBy, sortOrder, ...(cursor && { cursor }) };
}

/**
 * Build a standardized paginated response
 * @param items Array of items for current page
 * @param total Total count of all items
 * @param pagination Pagination parameters used
 * @returns Paginated result object
 */
export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  pagination: Pick<PaginationParams, 'page' | 'pageSize'>
): PaginatedResult<T> {
  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize),
  };
}

/**
 * Calculate skip value for database query
 */
export function getSkip(pagination: Pick<PaginationParams, 'page' | 'pageSize'>): number {
  return (pagination.page - 1) * pagination.pageSize;
}

/**
 * Validate cursor token to prevent SQL injection
 * @param cursor Cursor token from request
 * @returns Validated cursor or undefined if invalid
 */
export function validateCursor(cursor?: string): string | undefined {
  if (!cursor) return undefined;
  
  // Only allow base64url characters (A-Z, a-z, 0-9, -, _)
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) {
    return undefined;
  }
  
  // Limit length to prevent buffer overflow attacks
  if (cursor.length > 512) {
    return undefined;
  }
  
  return cursor;
}

/**
 * Validate cursor token for database queries
 * @param cursor Cursor token to validate
 * @throws Error if cursor is invalid
 */
export function assertValidCursor(cursor?: string): asserts cursor is string | undefined {
  if (cursor !== undefined && !validateCursor(cursor)) {
    throw new Error('Invalid cursor token format');
  }
}
