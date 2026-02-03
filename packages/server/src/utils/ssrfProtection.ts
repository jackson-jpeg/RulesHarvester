import dns from 'dns/promises';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { ValidationError } from '../middleware/errorHandler.js';

/**
 * SSRF Protection utilities for validating URLs and preventing attacks
 * Covers IPv4, IPv6, DNS rebinding, and redirect attacks
 */

/**
 * Check if an IPv6 address is private/internal
 * Covers: fc00::/7 (unique local), fe80::/10 (link-local), ::1 (loopback), ::ffff: (IPv4-mapped)
 */
export function isPrivateIPv6(hostname: string): boolean {
  // Remove brackets if present (e.g., [::1] -> ::1)
  const cleanHostname = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // Loopback (::1)
  if (cleanHostname === '::1') {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:x.x.x.x) - need to check the embedded IPv4
  const ipv4MappedMatch = cleanHostname.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i);
  if (ipv4MappedMatch) {
    const [, a, b] = ipv4MappedMatch.map(Number);
    // Check embedded IPv4 for private ranges
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
    if (a === 0) return true;
  }

  // Parse IPv6 address into segments
  // Handle :: expansion
  let expanded = cleanHostname;
  if (expanded.includes('::')) {
    const parts = expanded.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    const middle = Array(missing).fill('0');
    expanded = [...left, ...middle, ...right].join(':');
  }

  const segments = expanded.split(':');
  if (segments.length !== 8) {
    return false; // Invalid IPv6 format
  }

  // Parse first two segments for range checks
  const firstSegment = parseInt(segments[0], 16);

  // fc00::/7 - Unique local addresses (fc00:: to fdff::)
  if (firstSegment >= 0xfc00 && firstSegment <= 0xfdff) {
    return true;
  }

  // fe80::/10 - Link-local addresses (fe80:: to febf::)
  if (firstSegment >= 0xfe80 && firstSegment <= 0xfebf) {
    return true;
  }

  // All zeros (::) - unspecified address
  if (segments.every(s => parseInt(s, 16) === 0)) {
    return true;
  }

  return false;
}

/**
 * Check if an IPv4 address is private/internal
 */
export function isPrivateIPv4(hostname: string): boolean {
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) {
    return false;
  }

  const [, a, b] = ipv4Match.map(Number);

  // 10.x.x.x (Class A private)
  if (a === 10) return true;
  // 172.16.x.x - 172.31.x.x (Class B private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.x.x (Class C private)
  if (a === 192 && b === 168) return true;
  // 169.254.x.x (link-local)
  if (a === 169 && b === 254) return true;
  // 127.x.x.x (loopback)
  if (a === 127) return true;
  // 0.x.x.x (invalid/current network)
  if (a === 0) return true;

  return false;
}

/**
 * Check if a hostname is a private/internal address
 * Handles both IPv4 and IPv6
 */
export function isPrivateAddress(hostname: string): boolean {
  const cleanHostname = hostname.toLowerCase();

  // Check for localhost variations
  if (cleanHostname === 'localhost') {
    return true;
  }

  // Check common internal hostnames
  if (
    cleanHostname === 'metadata' ||
    cleanHostname === 'metadata.google.internal' ||
    cleanHostname.endsWith('.internal') ||
    cleanHostname.endsWith('.local')
  ) {
    return true;
  }

  // Check IPv4
  if (isPrivateIPv4(cleanHostname)) {
    return true;
  }

  // Check IPv6 (may be in brackets for URLs)
  if (isPrivateIPv6(cleanHostname)) {
    return true;
  }

  return false;
}

/**
 * Validate a URL after DNS resolution to prevent DNS rebinding attacks
 * This re-validates the resolved IP addresses before allowing the request
 */
export async function validateResolvedUrl(urlString: string): Promise<void> {
  const url = new URL(urlString);
  const hostname = url.hostname.replace(/^\[|\]$/g, ''); // Remove IPv6 brackets

  // Skip DNS resolution for IP addresses
  const isIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  const isIPv6 = hostname.includes(':');

  if (isIPv4 || isIPv6) {
    if (isPrivateAddress(hostname)) {
      throw new ValidationError('Resolved IP address is not allowed (private/internal network)');
    }
    return;
  }

  try {
    // Resolve the hostname and check all returned addresses
    const addresses = await dns.resolve(hostname);

    for (const address of addresses) {
      if (isPrivateAddress(address)) {
        throw new ValidationError(
          `DNS resolution returned private IP address for ${hostname}`
        );
      }
    }

    // Also check IPv6 addresses if available
    try {
      const ipv6Addresses = await dns.resolve6(hostname);
      for (const address of ipv6Addresses) {
        if (isPrivateIPv6(address)) {
          throw new ValidationError(
            `DNS resolution returned private IPv6 address for ${hostname}`
          );
        }
      }
    } catch {
      // IPv6 resolution may fail for hosts without AAAA records, that's fine
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    // DNS resolution failure - may be transient, allow but log
    console.warn(`DNS resolution failed for ${hostname}:`, error);
  }
}

/**
 * Validate a URL for SSRF protection
 * Checks protocol, hostname, and optionally resolves DNS
 */
export async function validatePublicUrl(
  urlString: string,
  options: { resolveDns?: boolean } = {}
): Promise<void> {
  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ValidationError('Invalid URL format');
  }

  // Only allow http/https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError('Only HTTP and HTTPS URLs are allowed');
  }

  // Check hostname against private ranges
  if (isPrivateAddress(url.hostname)) {
    throw new ValidationError('URLs pointing to private or internal networks are not allowed');
  }

  // Optionally validate resolved DNS
  if (options.resolveDns) {
    await validateResolvedUrl(urlString);
  }
}

/**
 * Create a secure axios instance with SSRF protection
 * - Validates redirects before following
 * - Limits redirect chain length
 * - Adds timeout
 */
export function createSecureAxiosInstance(options: {
  timeout?: number;
  maxRedirects?: number;
  userAgent?: string;
} = {}): AxiosInstance {
  const {
    timeout = 10000,
    maxRedirects = 5,
    userAgent = 'RulesHarvester/1.0 (Legal Research Bot)',
  } = options;

  const instance = axios.create({
    timeout,
    maxRedirects: 0, // We handle redirects manually
    validateStatus: () => true, // Don't throw on any status
    headers: {
      'User-Agent': userAgent,
    },
  });

  // Track redirect chain
  let redirectCount = 0;

  // Add response interceptor to handle redirects securely
  instance.interceptors.response.use(
    async (response) => {
      const status = response.status;

      // Handle redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers['location'];

        if (!location) {
          throw new ValidationError('Redirect without location header');
        }

        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw new ValidationError(`Too many redirects (max: ${maxRedirects})`);
        }

        // Resolve relative URLs
        const redirectUrl = new URL(location, response.config.url);
        const redirectUrlString = redirectUrl.toString();

        // Validate the redirect URL
        await validatePublicUrl(redirectUrlString, { resolveDns: true });

        // Follow the redirect
        return instance.get(redirectUrlString);
      }

      // Reset redirect count on successful non-redirect response
      redirectCount = 0;
      return response;
    },
    (error: AxiosError) => {
      // Reset redirect count on error
      redirectCount = 0;
      throw error;
    }
  );

  return instance;
}

/**
 * Validate URL and fetch with SSRF protection
 * Convenience function that combines validation and fetching
 */
export async function secureFetch(
  urlString: string,
  options: {
    timeout?: number;
    maxRedirects?: number;
    userAgent?: string;
  } = {}
): Promise<{
  data: string;
  status: number;
  url: string;
  contentType?: string;
}> {
  // Pre-validate the URL
  await validatePublicUrl(urlString, { resolveDns: true });

  // Create secure axios instance and make request
  const client = createSecureAxiosInstance(options);
  const response = await client.get(urlString);

  return {
    data: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
    status: response.status,
    url: response.config.url || urlString,
    contentType: response.headers['content-type'],
  };
}
