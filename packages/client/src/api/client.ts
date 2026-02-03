import type { ApiResponse } from '@rulesharvester/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // Initial delay in ms
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// Default timeout in ms
const DEFAULT_TIMEOUT = 30000;

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    options: { timeout?: number; retries?: number } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = options.retries ?? RETRY_CONFIG.maxRetries;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': generateRequestId(),
          },
          signal: controller.signal,
        };

        if (body) {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        // Check if we should retry on this status
        if (
          RETRY_CONFIG.retryableStatuses.includes(response.status) &&
          attempt < maxRetries
        ) {
          // Exponential backoff
          const delay = RETRY_CONFIG.retryDelay * Math.pow(2, attempt);
          console.warn(
            `API request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(delay);
          continue;
        }

        // Validate content type before parsing JSON
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error(
            `Unexpected response type: ${contentType || 'unknown'}`
          );
        }

        // Safe JSON parsing
        let data: ApiResponse<T>;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error('Failed to parse JSON response');
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || 'Request failed');
        }

        return data.data as T;
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle abort (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${timeout}ms`);
        } else if (error instanceof Error) {
          lastError = error;
        } else {
          lastError = new Error('Unknown error occurred');
        }

        // Don't retry on non-retryable errors or last attempt
        if (attempt >= maxRetries) {
          break;
        }

        // For network errors, retry with backoff
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          const delay = RETRY_CONFIG.retryDelay * Math.pow(2, attempt);
          console.warn(
            `Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(delay);
          continue;
        }

        // Non-retryable error, throw immediately
        throw lastError;
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', endpoint, body);
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', endpoint, body);
  }

  async delete<T = void>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>('DELETE', endpoint, body);
  }
}

export const api = new ApiClient(API_BASE);
