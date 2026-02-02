import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../index.js';
import {
  JurisdictionType,
  JurisdictionStatus,
  SyncFrequency,
  CLAUDE_MODEL_FAST,
  EXCLUDED_DOMAINS,
  DISCOVERY_SEARCH_QUERIES,
  CARTOGRAPHER_MAX_RESULTS,
  CartographerDiscoveryResponseSchema,
  CONFIDENCE_THRESHOLDS,
  InboxItemType,
} from '@rulesharvester/shared';
import type {
  CartographerSearchResult,
  CartographerDiscoveryResponse,
  JurisdictionDiscoveryCandidate,
  CartographerApprovalRequest,
  CartographerStatus,
} from '@rulesharvester/shared';
import { sseManager } from '../sse/sseManager.js';
import { cleanHtmlForLLM } from '../scraper/aiScraper.js';
import { autoHarvestService } from '../harvest/autoHarvestService.js';
import { inboxService } from '../inbox/inboxService.js';
import { logger } from '../../utils/logger.js';

const anthropic = new Anthropic();

// Court analysis tool definition for Claude
const COURT_ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_court_analysis',
  description: 'Submit analysis of whether a website is a legitimate court website with local rules',
  input_schema: {
    type: 'object' as const,
    properties: {
      isLegitimateCourtSite: {
        type: 'boolean',
        description: 'Whether this is an official court website (not a legal aggregator)',
      },
      jurisdictionType: {
        type: 'string',
        enum: ['FEDERAL_CIRCUIT', 'FEDERAL_DISTRICT', 'STATE', null],
        description: 'Type of jurisdiction (null if not determinable)',
      },
      suggestedName: {
        type: 'string',
        description: 'Suggested display name for this jurisdiction',
      },
      suggestedCode: {
        type: 'string',
        description: 'Suggested code (e.g., "9CIR", "NDCA", "CA-SUP")',
      },
      hasRulesSection: {
        type: 'boolean',
        description: 'Whether the site has a rules or local rules section',
      },
      rulesPageUrl: {
        type: 'string',
        description: 'URL to the rules page if found (null otherwise)',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0-100 in this analysis',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of the analysis',
      },
    },
    required: [
      'isLegitimateCourtSite',
      'jurisdictionType',
      'suggestedName',
      'suggestedCode',
      'hasRulesSection',
      'rulesPageUrl',
      'confidence',
      'reasoning',
    ],
  },
};

const COURT_ANALYSIS_SYSTEM = `You are an expert at identifying official court websites and their legal rules sections.

Analyze the provided webpage and determine:
1. Is this an official court website? (Not a legal aggregator like Westlaw, Findlaw, Justia, etc.)
2. What type of jurisdiction is it? (Federal Circuit, Federal District, or State court)
3. What's the appropriate name and code for this jurisdiction?
4. Does it have a local rules or rules of procedure section?
5. What's the URL to the rules page if you can find it?

Only mark isLegitimateCourtSite as true if this is an OFFICIAL court website with a .gov, .us, or official state domain.

Use the submit_court_analysis tool to submit your analysis.`;

interface DiscoverOptions {
  jurisdictionTypes?: JurisdictionType[];
  maxResults?: number;
  customQueries?: string[];
}

interface SearchWebResult {
  results: CartographerSearchResult[];
}

class CartographerService {
  private isRunning = false;
  private lastRunAt: Date | null = null;

  /**
   * Generate search queries based on jurisdiction types
   */
  generateSearchQueries(types?: JurisdictionType[]): string[] {
    const targetTypes = types || [
      JurisdictionType.FEDERAL_CIRCUIT,
      JurisdictionType.FEDERAL_DISTRICT,
      JurisdictionType.STATE,
    ];

    const queries: string[] = [];
    for (const type of targetTypes) {
      const typeQueries = DISCOVERY_SEARCH_QUERIES[type];
      if (typeQueries) {
        queries.push(...typeQueries);
      }
    }
    return queries;
  }

  /**
   * Check if a domain should be excluded
   */
  isExcludedDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return EXCLUDED_DOMAINS.some((excluded) => hostname.includes(excluded));
    } catch {
      return true; // Invalid URLs are excluded
    }
  }

  /**
   * Check if a domain is a valid court domain
   */
  isValidCourtDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      // Accept .gov, .us, and state court domains
      return (
        hostname.endsWith('.gov') ||
        hostname.endsWith('.us') ||
        hostname.includes('courts.') ||
        hostname.includes('judiciary.')
      );
    } catch {
      return false;
    }
  }

  /**
   * Search for court websites using Claude's web search tool
   */
  async searchForCourtWebsites(query: string): Promise<CartographerSearchResult[]> {
    try {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL_FAST,
        max_tokens: 2048,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: `Search for: ${query}

Please search for official court websites. I need to find:
- Official court websites (.gov or .us domains preferred)
- Pages with local rules, rules of procedure, or court rules
- Avoid legal aggregators like Westlaw, Findlaw, Justia, LexisNexis, or Casetext

Return the search results.`,
          },
        ],
      });

      // Extract search results from the response
      const results: CartographerSearchResult[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use' && block.name === 'web_search') {
          // The web search tool returns results in a structured format
          const searchResults = block.input as SearchWebResult;
          if (searchResults?.results) {
            for (const result of searchResults.results) {
              // Filter out excluded domains
              if (!this.isExcludedDomain(result.url)) {
                results.push({
                  url: result.url,
                  title: result.title || '',
                  snippet: result.snippet || '',
                  domain: new URL(result.url).hostname,
                });
              }
            }
          }
        }

        // Also check for text blocks that might contain parsed results
        if (block.type === 'text') {
          // Parse URLs from text response if needed
          const urlMatches = block.text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g);
          if (urlMatches) {
            for (const url of urlMatches) {
              try {
                const cleanUrl = url.replace(/[.,;:!?)]+$/, ''); // Clean trailing punctuation
                if (
                  !this.isExcludedDomain(cleanUrl) &&
                  this.isValidCourtDomain(cleanUrl)
                ) {
                  results.push({
                    url: cleanUrl,
                    title: '',
                    snippet: '',
                    domain: new URL(cleanUrl).hostname,
                  });
                }
              } catch {
                // Skip invalid URLs
              }
            }
          }
        }
      }

      // Deduplicate by domain
      const seen = new Set<string>();
      return results.filter((r) => {
        if (seen.has(r.domain)) return false;
        seen.add(r.domain);
        return true;
      });
    } catch (error) {
      console.error('Cartographer: Web search failed:', error);
      return [];
    }
  }

  /**
   * Analyze a search result to determine if it's a legitimate court site
   */
  async analyzeSearchResult(
    result: CartographerSearchResult,
    query: string
  ): Promise<CartographerDiscoveryResponse | null> {
    try {
      // Fetch the page
      const response = await fetch(result.url, {
        headers: { 'User-Agent': 'RulesHarvester/1.0 (Legal Research Bot)' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.log(`Cartographer: Failed to fetch ${result.url}: ${response.status}`);
        return null;
      }

      const html = await response.text();
      const cleanedHtml = cleanHtmlForLLM(html);

      // Analyze with Claude
      const analysisResponse = await anthropic.messages.create({
        model: CLAUDE_MODEL_FAST,
        max_tokens: 1024,
        system: COURT_ANALYSIS_SYSTEM,
        tools: [COURT_ANALYSIS_TOOL],
        tool_choice: { type: 'tool', name: 'submit_court_analysis' },
        messages: [
          {
            role: 'user',
            content: `Analyze this court website found via search query "${query}":

URL: ${result.url}
Title: ${result.title}
Snippet: ${result.snippet}

Page HTML:
${cleanedHtml}`,
          },
        ],
      });

      // Extract tool result
      const toolUse = analysisResponse.content.find(
        (block) => block.type === 'tool_use'
      );
      if (!toolUse || toolUse.type !== 'tool_use') {
        console.log('Cartographer: Claude did not return court analysis');
        return null;
      }

      // Validate with Zod
      const parseResult = CartographerDiscoveryResponseSchema.safeParse(toolUse.input);
      if (!parseResult.success) {
        console.error(
          'Cartographer: Invalid analysis response:',
          parseResult.error.message
        );
        return null;
      }

      return parseResult.data;
    } catch (error) {
      console.error(`Cartographer: Failed to analyze ${result.url}:`, error);
      return null;
    }
  }

  /**
   * Check if a jurisdiction already exists
   */
  async isDuplicateJurisdiction(
    url: string,
    suggestedCode: string
  ): Promise<boolean> {
    const domain = new URL(url).hostname;

    // Check by URL/domain
    const byUrl = await prisma.jurisdiction.findFirst({
      where: {
        OR: [
          { courtWebsite: { contains: domain } },
          { discoveryUrl: { contains: domain } },
          { code: suggestedCode },
        ],
      },
    });

    return byUrl !== null;
  }

  /**
   * Main discovery workflow
   */
  async discoverJurisdictions(
    options: DiscoverOptions = {}
  ): Promise<JurisdictionDiscoveryCandidate[]> {
    if (this.isRunning) {
      throw new Error('Discovery already in progress');
    }

    this.isRunning = true;
    this.lastRunAt = new Date();
    const discovered: JurisdictionDiscoveryCandidate[] = [];

    try {
      sseManager.sendCartographerDiscoveryStarted();

      const queries =
        options.customQueries || this.generateSearchQueries(options.jurisdictionTypes);
      const maxResults = options.maxResults || CARTOGRAPHER_MAX_RESULTS;

      console.log(
        `Cartographer: Starting discovery with ${queries.length} queries, max ${maxResults} results`
      );

      for (const query of queries) {
        if (discovered.length >= maxResults) break;

        console.log(`Cartographer: Searching for "${query}"`);
        const searchResults = await this.searchForCourtWebsites(query);
        console.log(`Cartographer: Found ${searchResults.length} results`);

        for (const result of searchResults) {
          if (discovered.length >= maxResults) break;

          // Skip if we've already found this domain
          if (discovered.some((d) => d.courtWebsite.includes(result.domain))) {
            continue;
          }

          // Analyze the result
          const analysis = await this.analyzeSearchResult(result, query);
          if (!analysis || !analysis.isLegitimateCourtSite) {
            console.log(
              `Cartographer: Skipping ${result.url} (not a legitimate court site)`
            );
            continue;
          }

          // Check for duplicates
          if (await this.isDuplicateJurisdiction(result.url, analysis.suggestedCode)) {
            console.log(
              `Cartographer: Skipping ${result.url} (duplicate jurisdiction)`
            );
            continue;
          }

          // Create jurisdiction in DISCOVERED status
          const jurisdictionId = uuidv4();
          const now = new Date();

          await prisma.jurisdiction.create({
            data: {
              id: jurisdictionId,
              code: analysis.suggestedCode,
              name: analysis.suggestedName,
              type: analysis.jurisdictionType || JurisdictionType.STATE,
              status: JurisdictionStatus.DISCOVERED,
              courtWebsite: analysis.rulesPageUrl || result.url,
              discoverySource: 'claude_web_search',
              discoveryScore: analysis.confidence,
              discoveryUrl: result.url,
              discoveryQuery: query,
              discoveredAt: now,
            },
          });

          const candidate: JurisdictionDiscoveryCandidate = {
            id: jurisdictionId,
            name: analysis.suggestedName,
            code: analysis.suggestedCode,
            type: analysis.jurisdictionType || JurisdictionType.STATE,
            courtWebsite: analysis.rulesPageUrl || result.url,
            discoveryScore: analysis.confidence,
            discoveryUrl: result.url,
            discoveryQuery: query,
            discoverySource: 'claude_web_search',
            discoveredAt: now,
            hasRulesSection: analysis.hasRulesSection,
            rulesPageUrl: analysis.rulesPageUrl || undefined,
            reasoning: analysis.reasoning,
          };

          discovered.push(candidate);
          logger.info(
            `Cartographer: Discovered ${analysis.suggestedName} (${analysis.suggestedCode}) with ${analysis.confidence}% confidence`
          );

          // Create inbox item for approval (unless auto-approve is enabled and confidence is high)
          if (analysis.confidence < CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
            await inboxService.createJurisdictionApprovalItem(
              jurisdictionId,
              analysis.suggestedName,
              analysis.confidence,
              result.url,
              {
                code: analysis.suggestedCode,
                type: analysis.jurisdictionType,
                hasRulesSection: analysis.hasRulesSection,
                rulesPageUrl: analysis.rulesPageUrl,
                reasoning: analysis.reasoning,
              }
            );
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Delay between queries
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      sseManager.sendCartographerDiscoveryComplete(discovered.length);
      console.log(`Cartographer: Discovery complete. Found ${discovered.length} new jurisdictions`);

      return discovered;
    } catch (error) {
      console.error('Cartographer: Discovery failed:', error);
      sseManager.sendCartographerDiscoveryFailed(
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get jurisdictions pending approval (DISCOVERED status)
   */
  async getDiscoveryQueue(options: {
    page?: number;
    pageSize?: number;
    sortBy?: 'discoveryScore' | 'discoveredAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    items: JurisdictionDiscoveryCandidate[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const sortBy = options.sortBy || 'discoveryScore';
    const sortOrder = options.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      prisma.jurisdiction.findMany({
        where: { status: JurisdictionStatus.DISCOVERED },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.jurisdiction.count({
        where: { status: JurisdictionStatus.DISCOVERED },
      }),
    ]);

    return {
      items: items.map((j) => ({
        id: j.id,
        name: j.name,
        code: j.code,
        type: j.type as JurisdictionType,
        courtWebsite: j.courtWebsite || '',
        discoveryScore: j.discoveryScore || 0,
        discoveryUrl: j.discoveryUrl || '',
        discoveryQuery: j.discoveryQuery || '',
        discoverySource: j.discoverySource || 'unknown',
        discoveredAt: j.discoveredAt || new Date(),
        hasRulesSection: true,
        reasoning: '',
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Approve a discovered jurisdiction and trigger auto-harvest
   */
  async approveJurisdiction(
    id: string,
    data: CartographerApprovalRequest = {}
  ): Promise<void> {
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id },
    });

    if (!jurisdiction) {
      throw new Error('Jurisdiction not found');
    }

    if (jurisdiction.status !== JurisdictionStatus.DISCOVERED) {
      throw new Error('Jurisdiction is not in DISCOVERED status');
    }

    // Update to AUTO_HARVESTING status (will be updated to SYNCED after harvest)
    await prisma.jurisdiction.update({
      where: { id },
      data: {
        status: JurisdictionStatus.AUTO_HARVESTING,
        name: data.name || jurisdiction.name,
        code: data.code || jurisdiction.code,
        autoSyncEnabled: data.autoSyncEnabled ?? false,
        syncFrequency: data.syncFrequency || SyncFrequency.WEEKLY,
        approvedAt: new Date(),
        approvedBy: 'system', // TODO: Add user tracking
      },
    });

    sseManager.sendJurisdictionApproved(id, jurisdiction.name);
    logger.info(`Cartographer: Approved jurisdiction ${jurisdiction.name}`);

    // Trigger auto-harvest in background (don't await)
    autoHarvestService.initiateHarvest(id).catch((error) => {
      logger.error(
        `Cartographer: Auto-harvest failed for ${jurisdiction.name}:`,
        error
      );
    });
  }

  /**
   * Reject a discovered jurisdiction
   */
  async rejectJurisdiction(id: string, reason: string): Promise<void> {
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id },
    });

    if (!jurisdiction) {
      throw new Error('Jurisdiction not found');
    }

    if (jurisdiction.status !== JurisdictionStatus.DISCOVERED) {
      throw new Error('Jurisdiction is not in DISCOVERED status');
    }

    await prisma.jurisdiction.update({
      where: { id },
      data: {
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // Delete rejected jurisdictions to keep database clean
    await prisma.jurisdiction.delete({
      where: { id },
    });

    console.log(`Cartographer: Rejected jurisdiction ${jurisdiction.name}: ${reason}`);
  }

  /**
   * Bulk approve jurisdictions
   */
  async bulkApprove(ids: string[]): Promise<{ approved: number; failed: number }> {
    let approved = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        await this.approveJurisdiction(id);
        approved++;
      } catch (error) {
        console.error(`Cartographer: Failed to approve ${id}:`, error);
        failed++;
      }
    }

    return { approved, failed };
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<CartographerStatus> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalDiscovered, pendingApproval, approvedToday] = await Promise.all([
      prisma.jurisdiction.count({
        where: { discoverySource: 'claude_web_search' },
      }),
      prisma.jurisdiction.count({
        where: { status: JurisdictionStatus.DISCOVERED },
      }),
      prisma.jurisdiction.count({
        where: {
          approvedAt: { gte: today },
        },
      }),
    ]);

    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt || undefined,
      totalDiscovered,
      pendingApproval,
      approvedToday,
    };
  }
}

export const cartographerService = new CartographerService();
