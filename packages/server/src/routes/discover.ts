import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import { scraperService } from '../services/scraper/scraperService.js';
import { BatchAcquireRequestSchema } from '@rulesharvester/shared';
import { validatePublicUrl } from '../utils/ssrfProtection.js';

export const discoverRouter = Router();

// Scrape a specific URL for rule content
discoverRouter.post(
  '/scrape',
  asyncHandler(async (req, res) => {
    const { url, jurisdictionId } = req.body;

    if (!url) {
      throw new ValidationError('url is required');
    }

    // Validate URL format and block private/internal URLs (SSRF protection)
    // Also validates DNS resolution to prevent DNS rebinding attacks
    await validatePublicUrl(url, { resolveDns: true });

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
    // Also validates DNS resolution to prevent DNS rebinding attacks
    await validatePublicUrl(baseUrl, { resolveDns: true });

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

    // Atomic update: only update if status is DISCOVERED (prevents TOCTOU race)
    const updateResult = await prisma.discoveryCandidate.updateMany({
      where: {
        id,
        status: 'DISCOVERED', // Only acquire if still in DISCOVERED state
      },
      data: { status: 'PROCESSING' },
    });

    // If no rows updated, either not found or already acquired
    if (updateResult.count === 0) {
      const candidate = await prisma.discoveryCandidate.findUnique({
        where: { id },
      });

      if (!candidate) {
        throw new NotFoundError('Discovery candidate');
      }

      throw new ValidationError(`Candidate already ${candidate.status.toLowerCase()}`);
    }

    // Fetch the updated candidate
    const candidate = await prisma.discoveryCandidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      throw new NotFoundError('Discovery candidate');
    }

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
  validateBody(BatchAcquireRequestSchema),
  asyncHandler(async (req, res) => {
    const { candidateIds } = req.body;

    // Atomic batch update: only update candidates in DISCOVERED state (prevents race)
    const updateResult = await prisma.discoveryCandidate.updateMany({
      where: {
        id: { in: candidateIds },
        status: 'DISCOVERED', // Only acquire if still in DISCOVERED state
      },
      data: { status: 'PROCESSING' },
    });

    // Fetch all candidates to build results
    const candidates = await prisma.discoveryCandidate.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, status: true },
    });

    // Build lookup map for quick access
    const candidateMap = new Map(candidates.map(c => [c.id, c]));

    // Build results based on original candidateIds order
    const results = candidateIds.map((id: string) => {
      const candidate = candidateMap.get(id);
      if (!candidate) {
        return { id, status: 'not_found' };
      }
      // If status is PROCESSING, it was just updated (queued)
      if (candidate.status === 'PROCESSING') {
        return { id, status: 'queued' };
      }
      // Otherwise it was already in a different state
      return { id, status: 'skipped', reason: candidate.status.toLowerCase() };
    });

    res.json({
      success: true,
      data: {
        results,
        queued: updateResult.count,
        total: candidateIds.length,
      },
    });
  })
);
