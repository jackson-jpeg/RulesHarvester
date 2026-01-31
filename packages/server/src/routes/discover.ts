import { Router } from 'express';
import { prisma } from '../index.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { scraperService } from '../services/scraper/scraperService.js';

export const discoverRouter = Router();

// Scrape a specific URL for rule content
discoverRouter.post(
  '/scrape',
  asyncHandler(async (req, res) => {
    const { url, jurisdictionId } = req.body;

    if (!url) {
      throw new ValidationError('url is required');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new ValidationError('Invalid URL format');
    }

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
          for (const candidate of candidates) {
            await prisma.discoveryCandidate.create({
              data: {
                jurisdictionId,
                jurisdiction: jurisdiction.name,
                ruleId: candidate.ruleCode,
                snippet: candidate.snippet.slice(0, 1000), // Truncate long snippets
                sourceUrl: url,
                relevanceScore: candidate.relevanceScore,
                status: 'DISCOVERED',
              },
            });
          }
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

    // Validate URL format
    try {
      new URL(baseUrl);
    } catch {
      throw new ValidationError('Invalid URL format');
    }

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
        for (const page of result.pages) {
          const candidates = scraperService.extractRuleCandidates(page);
          for (const candidate of candidates) {
            await prisma.discoveryCandidate.create({
              data: {
                jurisdictionId,
                jurisdiction: jurisdiction.name,
                ruleId: candidate.ruleCode,
                snippet: candidate.snippet.slice(0, 1000),
                sourceUrl: page.url,
                relevanceScore: candidate.relevanceScore,
                status: 'DISCOVERED',
              },
            });
            totalCandidates++;
          }
        }
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

    const results = [];

    for (const id of candidateIds) {
      const candidate = await prisma.discoveryCandidate.findUnique({
        where: { id },
      });

      if (candidate && candidate.status === 'DISCOVERED') {
        await prisma.discoveryCandidate.update({
          where: { id },
          data: { status: 'PROCESSING' },
        });
        results.push({ id, status: 'queued' });
      } else {
        results.push({ id, status: 'skipped' });
      }
    }

    res.json({ success: true, data: results });
  })
);
