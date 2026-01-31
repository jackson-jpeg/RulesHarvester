/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: (error: unknown) => {
    // Retry on network errors, rate limits, and server errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Rate limits (429)
      if (message.includes('rate') || message.includes('429')) return true;
      // Server errors (5xx)
      if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) return true;
      // Network errors
      if (message.includes('network') || message.includes('timeout') || message.includes('econnreset')) return true;
      // Anthropic overloaded
      if (message.includes('overloaded')) return true;
    }
    return false;
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt >= opts.maxRetries || !opts.retryableErrors(error)) {
        throw error;
      }

      console.log(
        `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms delay. Error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );

      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Creates a retryable version of an async function
 */
export function makeRetryable<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: RetryOptions
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}
