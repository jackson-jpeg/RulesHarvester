import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { scraperService } from '../services/scraper/scraperService.js';

export const discoverRouter = Router();

// SSRF Protection: Block private/internal IP ranges and localhost
function isPrivateOrLocalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block localhost variations
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // Block common internal hostnames
    if (hostname === 'metadata' || hostname === 'metadata.google.internal' || hostname.endsWith('.internal')) {
      return true;
    }

    // Block private IP ranges (RFC 1918 + link-local)
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
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
      // 0.x.x.x (invalid)
      if (a === 0) return true;
    }

    return false;
  } catch {
    return true; // Invalid URL = block it
  }
}

function validatePublicUrl(urlString: string): void {
  // First check format
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

  // Block private/internal URLs (SSRF protection)
  if (isPrivateOrLocalUrl(urlString)) {
    throw new ValidationError('URLs pointing to private or internal networks are not allowed');
  }
}

// Scrape a specific URL for rule content
discoverRouter.post(
  '/scrape',
  asyncHandler(async (req, res) => {
    const { url, jurisdictionId } = req.body;

    if (!url) {
      throw new ValidationError('url is required');
    }

    // Validate URL format and block private/internal URLs (SSRF protection)
    validatePublicUrl(url);

    const result = await scraperService.scrapeUrl(url);

    // If jurisdiction is specified, create discovery candidates from the scraped content
    let candidates: { ruleCode: string; snippet: string; relevanceScore: number }[] = [];
    if (jurisdictionId) {
      candidates = scraperService.extractRuleCandidates(result);

      // Save candidates to database
      if (candidates.length > 0) {
        const jurisdiction = await prisma.jurisdiction.findUnique({
          where: { id: jurisdictionId },
        });

        if (jurisdiction) {
          await prisma.discoveryCandidate.createMany({
            data: candidates.map((candidate) => ({
              jurisdictionId,
              jurisdiction: jurisdiction.name,
              ruleId: candidate.ruleCode,
              snippet: candidate.snippet.slice(0, 1000), // Truncate long snippets
              sourceUrl: url,
              relevanceScore: candidate.relevanceScore,
              status: 'DISCOVERED' as const,
            })),
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        url: result.url,
        title: result.title,
        ruleCode: result.ruleCode,
        contentLength: result.metadata.contentLength,
        linksFound: result.links.length,
        candidates: candidates.length,
        scrapedAt: result.metadata.scrapedAt,
      },
    });
  })
);

// Crawl a court website to auto-discover rules
discoverRouter.post(
  '/crawl',
  asyncHandler(async (req, res) => {
    const { baseUrl, jurisdictionId, maxPages = 20 } = req.body;

    if (!baseUrl) {
      throw new ValidationError('baseUrl is required');
    }

    // Validate URL format and block private/internal URLs (SSRF protection)
    validatePublicUrl(baseUrl);

    if (maxPages > 50) {
      throw new ValidationError('maxPages cannot exceed 50');
    }

    const result = await scraperService.crawlSite(baseUrl, {
      maxPages: Math.min(maxPages, 50),
      followLinks: true,
    });

    // If jurisdiction is specified, create discovery candidates
    let totalCandidates = 0;
    if (jurisdictionId) {
      const jurisdiction = await prisma.jurisdiction.findUnique({
        where: { id: jurisdictionId },
      });

      if (jurisdiction) {
        // Collect all candidates from all pages
        const allCandidates: {
          jurisdictionId: string;
          jurisdiction: string;
          ruleId: string;
          snippet: string;
          sourceUrl: string;
          relevanceScore: number;
          status: 'DISCOVERED';
        }[] = [];

        for (const page of result.pages) {
          const candidates = scraperService.extractRuleCandidates(page);
          for (const candidate of candidates) {
            allCandidates.push({
              jurisdictionId,
              jurisdiction: jurisdiction.name,
              ruleId: candidate.ruleCode,
              snippet: candidate.snippet.slice(0, 1000),
              sourceUrl: page.url,
              relevanceScore: candidate.relevanceScore,
              status: 'DISCOVERED',
            });
          }
        }

        // Batch insert all candidates
        if (allCandidates.length > 0) {
          await prisma.discoveryCandidate.createMany({
            data: allCandidates,
          });
        }
        totalCandidates = allCandidates.length;
      }
    }

    res.json({
      success: true,
      data: {
        baseUrl: result.baseUrl,
        pagesScraped: result.pages.length,
        errors: result.errors.length,
        candidatesFound: totalCandidates,
        duration: result.metadata.completedAt.getTime() - result.metadata.startedAt.getTime(),
        errorDetails: result.errors.slice(0, 5), // Return first 5 errors
      },
    });
  })
);

// Get discovery candidates for a jurisdiction
discoverRouter.get(
  '/:jurisdictionId',
  asyncHandler(async (req, res) => {
    const jurisdictionId = req.params.jurisdictionId as string;
    const candidates = await prisma.discoveryCandidate.findMany({
      where: { jurisdictionId },
      orderBy: { relevanceScore: 'desc' },
    });

    res.json({ success: true, data: candidates });
  })
);

// Create discovery candidate manually
discoverRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { jurisdictionId, ruleId, snippet, sourceUrl, relevanceScore } = req.body;

    if (!jurisdictionId || !ruleId || !sourceUrl) {
      throw new ValidationError('jurisdictionId, ruleId, and sourceUrl are required');
    }

    // Verify jurisdiction exists
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: jurisdictionId },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    const candidate = await prisma.discoveryCandidate.create({
      data: {
        jurisdictionId,
        jurisdiction: jurisdiction.name,
        ruleId,
        snippet: snippet || '',
        sourceUrl,
        relevanceScore: relevanceScore || 50,
        status: 'DISCOVERED',
      },
    });

    res.status(201).json({ success: true, data: candidate });
  })
);

// Acquire a discovered candidate (trigger extraction)
discoverRouter.post(
  '/:id/acquire',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const candidate = await prisma.discoveryCandidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      throw new NotFoundError('Discovery candidate');
    }

    if (candidate.status === 'ACQUIRED') {
      throw new ValidationError('Candidate already acquired');
    }

    // Update status to processing
    await prisma.discoveryCandidate.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    // Create extraction job
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: candidate.jurisdictionId },
    });

    if (!jurisdiction) {
      throw new NotFoundError('Jurisdiction');
    }

    const job = await prisma.extractionJob.create({
      data: {
        jurisdictionId: candidate.jurisdictionId,
        jurisdictionCode: jurisdiction.code,
        sourceUrl: candidate.sourceUrl,
        status: 'PENDING',
        progress: 0,
        currentStep: 'Queued for extraction',
      },
    });

    res.json({ success: true, data: { candidate, job } });
  })
);

// Reject a discovery candidate
discoverRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const candidate = await prisma.discoveryCandidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      throw new NotFoundError('Discovery candidate');
    }

    await prisma.discoveryCandidate.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    res.json({ success: true, message: 'Candidate rejected' });
  })
);

// Batch acquire multiple candidates
discoverRouter.post(
  '/batch/acquire',
  asyncHandler(async (req, res) => {
    const { candidateIds } = req.body;

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      throw new ValidationError('candidateIds array is required');
    }

    // Fetch all candidates in a single query (fix N+1)
    const candidates = await prisma.discoveryCandidate.findMany({
      where: { id: { in: candidateIds } },
    });

    // Build lookup map for quick access
    const candidateMap = new Map(candidates.map(c => [c.id, c]));

    // Identify candidates to update
    const toUpdate = candidates
      .filter(c => c.status === 'DISCOVERED')
      .map(c => c.id);

    // Batch update in a transaction
    if (toUpdate.length > 0) {
      await prisma.discoveryCandidate.updateMany({
        where: { id: { in: toUpdate } },
        data: { status: 'PROCESSING' },
      });
    }

    // Build results based on original candidateIds order
    const results = candidateIds.map(id => {
      const candidate = candidateMap.get(id);
      if (!candidate) {
        return { id, status: 'not_found' };
      }
      if (candidate.status === 'DISCOVERED') {
        return { id, status: 'queued' };
      }
      return { id, status: 'skipped' };
    });

    res.json({ success: true, data: results });
  })
);
