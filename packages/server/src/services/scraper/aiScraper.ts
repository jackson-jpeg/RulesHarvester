import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { prisma } from '../../index.js';
import type { ScraperConfig } from '@rulesharvester/shared';
import { ScraperDiscoveryResponseSchema } from '@rulesharvester/shared';
import { GENERIC_CONFIG } from './courtSites.js';
import { logger } from '../../utils/logger.js';
import { validatePublicUrl, secureFetch } from '../../utils/ssrfProtection.js';

const anthropic = new Anthropic();

// Selector validation result
export interface SelectorValidationResult {
  isValid: boolean;
  matchCounts: {
    ruleListSelector: number;
    ruleLinkSelector: number;
    ruleContentSelector: number;
    ruleCodeSelector?: number;
    ruleTitleSelector?: number;
    paginationSelector?: number;
  };
  errors: string[];
}

// Clean HTML for LLM - remove noise, compress DOM
export function cleanHtmlForLLM(html: string): string {
  const $ = cheerio.load(html);

  // Remove noise elements
  $('script, style, svg, noscript, iframe, img, video, audio').remove();
  $('nav, footer, header, aside, .nav, .footer, .header, .sidebar').remove();
  $('[style]').removeAttr('style');
  $('[onclick], [onload], [onerror]').removeAttr('onclick').removeAttr('onload').removeAttr('onerror');

  // Get cleaned HTML
  let cleaned = $.html();

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/>\s+</g, '><');

  // Truncate to ~80KB for context window
  if (cleaned.length > 80000) {
    cleaned = cleaned.substring(0, 80000) + '<!-- truncated -->';
  }

  return cleaned;
}

// Cartographer tool definition
const CARTOGRAPHER_TOOL: Anthropic.Tool = {
  name: 'submit_scraper_config',
  description: 'Submit discovered CSS selectors for scraping this court website',
  input_schema: {
    type: 'object' as const,
    properties: {
      ruleListSelector: { type: 'string', description: 'CSS selector for container holding list of rules' },
      ruleLinkSelector: { type: 'string', description: 'CSS selector for links to individual rule pages' },
      ruleContentSelector: { type: 'string', description: 'CSS selector for main rule content area' },
      ruleCodeSelector: { type: 'string', description: 'CSS selector for rule number/code element' },
      ruleTitleSelector: { type: 'string', description: 'CSS selector for rule title element' },
      paginationSelector: { type: 'string', description: 'CSS selector for pagination navigation' },
      confidence: { type: 'number', description: 'Confidence in discovered selectors (0-100)' },
      reasoning: { type: 'string', description: 'Explanation of how selectors were identified' },
    },
    required: ['ruleListSelector', 'ruleLinkSelector', 'ruleContentSelector', 'confidence', 'reasoning'],
  },
};

const CARTOGRAPHER_SYSTEM = `You are an expert web scraper analyst for legal court websites.
Analyze the HTML and identify CSS selectors for extracting legal rules.

Identify:
1. ruleListSelector - Container holding list of rules (e.g., ul.rules, .rule-list, table.rules)
2. ruleLinkSelector - Links to individual rule pages (e.g., a[href*="rule"], a.rule-link)
3. ruleContentSelector - Main content area on rule pages (e.g., article, .rule-content, #main)
4. ruleCodeSelector (optional) - Element with rule number/code
5. ruleTitleSelector (optional) - Element with rule title
6. paginationSelector (optional) - Pagination navigation

Prefer:
- Specific selectors (avoid overly broad like "a" or "div")
- Stable selectors (classes/IDs over positional)
- Semantic selectors (meaningful class names)

Use the submit_scraper_config tool to return your analysis.`;

// Discover selectors using Claude
async function discoverSelectorsWithClaude(
  cleanedHtml: string,
  url: string,
  jurisdictionName: string
): Promise<ScraperConfig> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: CARTOGRAPHER_SYSTEM,
      tools: [CARTOGRAPHER_TOOL],
      tool_choice: { type: 'tool', name: 'submit_scraper_config' },
      messages: [{
        role: 'user',
        content: `Analyze this court website HTML for ${jurisdictionName} (${url}):\n\n${cleanedHtml}`
      }],
    });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        logger.error('Claude API timeout during selector discovery', {
          jurisdictionName,
          url,
          error: error.message,
          type: 'claude_timeout'
        });
        throw new Error(`Claude API timeout: ${error.message}`);
      }
      logger.error('Claude API error during selector discovery', {
        jurisdictionName,
        url,
        error: error.message,
        type: 'claude_api_error'
      });
    }
    throw error;
  }

  // Extract tool result
  const toolUse = response.content.find(block => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return selector configuration');
  }

  // Validate Claude's response with Zod schema
  const parseResult = ScraperDiscoveryResponseSchema.safeParse(toolUse.input);
  if (!parseResult.success) {
    throw new Error(`Invalid scraper discovery response: ${parseResult.error.message}`);
  }

  const input = parseResult.data;

  return {
    name: jurisdictionName,
    baseUrl: new URL(url).origin,
    ruleListSelector: input.ruleListSelector,
    ruleLinkSelector: input.ruleLinkSelector,
    ruleContentSelector: input.ruleContentSelector,
    ruleCodeSelector: input.ruleCodeSelector,
    ruleTitleSelector: input.ruleTitleSelector,
    paginationSelector: input.paginationSelector,
    rateLimitMs: 2000,
    discoveredAt: new Date().toISOString(),
    confidence: input.confidence,
    discoveryReasoning: input.reasoning,
  };
}

// Main entry point - check cache first, then discover
export async function getScrapingStrategy(
  url: string,
  jurisdictionId: string
): Promise<ScraperConfig> {
  // 1. Check for cached config
  const jurisdiction = await prisma.jurisdiction.findUnique({
    where: { id: jurisdictionId },
    select: { scraperConfig: true, name: true },
  });

  if (jurisdiction?.scraperConfig) {
    logger.info('Using cached scraper config', {
      jurisdictionName: jurisdiction.name,
      jurisdictionId
    });
    return jurisdiction.scraperConfig as unknown as ScraperConfig;
  }

  // 2. Fetch and clean HTML
  logger.info('Discovering scraper config', {
    jurisdictionName: jurisdiction?.name || jurisdictionId,
    url
  });

  let html: string;
  try {
    await validatePublicUrl(url, { resolveDns: true });
    const response = await secureFetch(url, {
      timeout: 15000,
      userAgent: 'RulesHarvester/1.0'
    });
    
    if (response.status >= 400) {
      logger.error('Failed to fetch page for discovery', {
        url,
        status: response.status,
        type: 'fetch_error'
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText || 'Unknown error'}`);
    }
    
    html = response.data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('SSR') || error.message.includes('private')) {
        logger.error('SSRF protection blocked URL', {
          url,
          error: error.message,
          type: 'ssrf_block'
        });
        throw new Error(`SSRF protection: ${error.message}`);
      }
      logger.error('Network error during discovery', {
        url,
        error: error.message,
        type: 'network_error'
      });
    }
    throw error;
  }
  
  const cleanedHtml = cleanHtmlForLLM(html);

  // 3. Ask Claude to discover selectors
  try {
    const config = await discoverSelectorsWithClaude(
      cleanedHtml,
      url,
      jurisdiction?.name || 'Unknown Court'
    );

    // 4. Save to database
    await prisma.jurisdiction.update({
      where: { id: jurisdictionId },
      data: { scraperConfig: JSON.parse(JSON.stringify(config)) },
    });

    logger.info('Successfully discovered and cached config', {
      jurisdictionName: jurisdiction?.name || jurisdictionId,
      confidence: config.confidence,
      url
    });
    return config;
  } catch (error) {
    logger.errorWithStack('Cartographer discovery failed, falling back to generic config', error, {
      jurisdictionName: jurisdiction?.name || jurisdictionId,
      url,
      type: 'discovery_failure'
    });

    // Fall back to generic config
    const fallback: ScraperConfig = {
      ...GENERIC_CONFIG,
      baseUrl: new URL(url).origin,
      discoveredAt: new Date().toISOString(),
      confidence: 0,
      discoveryReasoning: `Discovery failed: ${error instanceof Error ? error.message : String(error)}. Using generic fallback.`,
    };

    try {
      await prisma.jurisdiction.update({
        where: { id: jurisdictionId },
        data: { scraperConfig: JSON.parse(JSON.stringify(fallback)) },
      });
    } catch (dbError) {
      logger.errorWithStack('Failed to save fallback config to database', dbError, {
        jurisdictionId,
        type: 'database_error'
      });
    }

    return fallback;
  }
}

/**
 * Validate that discovered selectors actually match elements on the page
 */
export async function validateSelectors(
  url: string,
  config: ScraperConfig
): Promise<SelectorValidationResult> {
  const errors: string[] = [];
  const matchCounts = {
    ruleListSelector: 0,
    ruleLinkSelector: 0,
    ruleContentSelector: 0,
    ruleCodeSelector: 0,
    ruleTitleSelector: 0,
    paginationSelector: 0,
  };

  try {
    await validatePublicUrl(url, { resolveDns: true });
    const response = await secureFetch(url, {
      timeout: 10000,
      userAgent: 'RulesHarvester/1.0'
    });

    if (response.status >= 400) {
      logger.warn('Selector validation failed due to HTTP error', {
        url,
        status: response.status,
        type: 'validation_fetch_error'
      });
      return {
        isValid: false,
        matchCounts,
        errors: [`Failed to fetch page: ${response.status}`],
      };
    }

    const html = response.data;
    const $ = cheerio.load(html);

    // Check required selectors
    matchCounts.ruleListSelector = $(config.ruleListSelector).length;
    if (matchCounts.ruleListSelector === 0) {
      errors.push(`ruleListSelector "${config.ruleListSelector}" matches 0 elements`);
    }

    matchCounts.ruleLinkSelector = $(config.ruleLinkSelector).length;
    if (matchCounts.ruleLinkSelector === 0) {
      errors.push(`ruleLinkSelector "${config.ruleLinkSelector}" matches 0 elements`);
    }

    matchCounts.ruleContentSelector = $(config.ruleContentSelector).length;
    if (matchCounts.ruleContentSelector === 0) {
      errors.push(`ruleContentSelector "${config.ruleContentSelector}" matches 0 elements`);
    }

    // Check optional selectors (only add errors if they're defined but don't match)
    if (config.ruleCodeSelector) {
      matchCounts.ruleCodeSelector = $(config.ruleCodeSelector).length;
    }

    if (config.ruleTitleSelector) {
      matchCounts.ruleTitleSelector = $(config.ruleTitleSelector).length;
    }

    if (config.paginationSelector) {
      matchCounts.paginationSelector = $(config.paginationSelector).length;
    }

    // Valid if all required selectors match at least one element
    const isValid =
      matchCounts.ruleListSelector > 0 &&
      matchCounts.ruleLinkSelector > 0 &&
      matchCounts.ruleContentSelector > 0;

    return { isValid, matchCounts, errors };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('SSR') || error.message.includes('private')) {
        logger.error('SSRF protection blocked URL during validation', {
          url,
          error: error.message,
          type: 'ssrf_block_validation'
        });
      } else {
        logger.errorWithStack('Error during selector validation', error, {
          url,
          type: 'validation_error'
        });
      }
    }
    return {
      isValid: false,
      matchCounts,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
