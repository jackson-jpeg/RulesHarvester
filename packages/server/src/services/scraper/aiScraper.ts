import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { prisma } from '../../index.js';
import type { ScraperConfig } from '@rulesharvester/shared';
import { GENERIC_CONFIG } from './courtSites.js';

const anthropic = new Anthropic();

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

  // Extract tool result
  const toolUse = response.content.find(block => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return selector configuration');
  }

  const input = toolUse.input as Record<string, unknown>;

  return {
    name: jurisdictionName,
    baseUrl: new URL(url).origin,
    ruleListSelector: input.ruleListSelector as string,
    ruleLinkSelector: input.ruleLinkSelector as string,
    ruleContentSelector: input.ruleContentSelector as string,
    ruleCodeSelector: input.ruleCodeSelector as string | undefined,
    ruleTitleSelector: input.ruleTitleSelector as string | undefined,
    paginationSelector: input.paginationSelector as string | undefined,
    rateLimitMs: 2000,
    discoveredAt: new Date().toISOString(),
    confidence: input.confidence as number,
    discoveryReasoning: input.reasoning as string,
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
    console.log(`Using cached scraper config for ${jurisdiction.name}`);
    return jurisdiction.scraperConfig as unknown as ScraperConfig;
  }

  // 2. Fetch and clean HTML
  console.log(`Discovering scraper config for ${jurisdiction?.name || jurisdictionId}...`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'RulesHarvester/1.0' },
  });
  const html = await response.text();
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

    console.log(`Discovered and cached config with ${config.confidence}% confidence`);
    return config;
  } catch (error) {
    console.error('Cartographer discovery failed:', error);

    // Fall back to generic config
    const fallback: ScraperConfig = {
      ...GENERIC_CONFIG,
      baseUrl: new URL(url).origin,
      discoveredAt: new Date().toISOString(),
      confidence: 0,
      discoveryReasoning: `Discovery failed: ${error}. Using generic fallback.`,
    };

    await prisma.jurisdiction.update({
      where: { id: jurisdictionId },
      data: { scraperConfig: JSON.parse(JSON.stringify(fallback)) },
    });

    return fallback;
  }
}
