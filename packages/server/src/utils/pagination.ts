import type { Request } from 'express';

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
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

  return { page, pageSize, sortBy, sortOrder };
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
