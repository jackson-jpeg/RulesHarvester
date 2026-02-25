import rateLimit from 'express-rate-limit';

/**
 * Creates a strict POST-only rate limiter for high-traffic endpoints.
 * @param endpointName - Used in the error message and key prefix.
 * @returns Express middleware function.
 */
export function createPostRateLimiter(endpointName: string) {
  return rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20, // 20 POST requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: `Too many ${endpointName} requests, please try again later`,
    },
    // Only apply to POST requests
    skip: (req) => req.method !== 'POST',
    // Unique key per endpoint to avoid cross-endpoint interference
    keyGenerator: (req) => `${endpointName}:${req.ip}`,
  });
}