/**
 * Court website configurations for scraping
 * Each site has selectors for extracting rule content
 */

import { prisma } from '../../index.js';
import { getScrapingStrategy } from './aiScraper.js';

export interface CourtSiteConfig {
  name: string;
  baseUrl: string;
  ruleListSelector: string;
  ruleLinkSelector: string;
  ruleContentSelector: string;
  ruleCodeSelector?: string;
  ruleTitleSelector?: string;
  paginationSelector?: string;
  rateLimitMs: number;
}

// Federal court configurations
export const FEDERAL_COURT_SITES: Record<string, CourtSiteConfig> = {
  'uscourts': {
    name: 'U.S. Courts',
    baseUrl: 'https://www.uscourts.gov',
    ruleListSelector: '.views-row, .rule-item',
    ruleLinkSelector: 'a[href*="rule"], a[href*="local-rule"]',
    ruleContentSelector: '.field--name-body, .rule-content, article',
    ruleCodeSelector: '.rule-number, h1, h2',
    ruleTitleSelector: '.rule-title, h1, h2',
    rateLimitMs: 2000,
  },
  'ca9': {
    name: 'Ninth Circuit',
    baseUrl: 'https://www.ca9.uscourts.gov',
    ruleListSelector: '.view-content .views-row',
    ruleLinkSelector: 'a',
    ruleContentSelector: '.field-content, .node-content',
    ruleCodeSelector: '.field--name-title',
    rateLimitMs: 2000,
  },
  'ca2': {
    name: 'Second Circuit',
    baseUrl: 'https://www.ca2.uscourts.gov',
    ruleListSelector: '.view-content .views-row',
    ruleLinkSelector: 'a',
    ruleContentSelector: '.field-content, .node-content',
    rateLimitMs: 2000,
  },
};

// State court configurations
export const STATE_COURT_SITES: Record<string, CourtSiteConfig> = {
  'ca-courts': {
    name: 'California Courts',
    baseUrl: 'https://www.courts.ca.gov',
    ruleListSelector: '.list-item, .rule-list li',
    ruleLinkSelector: 'a[href*="rule"]',
    ruleContentSelector: '.content-body, .rule-text',
    ruleCodeSelector: '.rule-number',
    ruleTitleSelector: '.rule-title',
    rateLimitMs: 2000,
  },
  'ny-courts': {
    name: 'New York Courts',
    baseUrl: 'https://www.nycourts.gov',
    ruleListSelector: '.content-list li, .rule-item',
    ruleLinkSelector: 'a[href*="rule"]',
    ruleContentSelector: '.content, .rule-content',
    rateLimitMs: 2000,
  },
  'tx-courts': {
    name: 'Texas Courts',
    baseUrl: 'https://www.txcourts.gov',
    ruleListSelector: '.list-item, table tr',
    ruleLinkSelector: 'a[href*="rule"], a[href*=".pdf"]',
    ruleContentSelector: '.content, .rule-body',
    rateLimitMs: 2000,
  },
};

// Generic configuration for unknown sites
export const GENERIC_CONFIG: CourtSiteConfig = {
  name: 'Generic',
  baseUrl: '',
  ruleListSelector: 'li, tr, .item, article',
  ruleLinkSelector: 'a',
  ruleContentSelector: 'body, main, article, .content',
  rateLimitMs: 3000,
};

/**
 * Get site configuration by URL - checks DB first, then hardcoded, then AI discovery
 */
export async function getSiteConfig(
  url: string,
  jurisdictionId?: string
): Promise<CourtSiteConfig> {
  const hostname = new URL(url).hostname.toLowerCase();

  // 1. Check database for cached AI-discovered config
  if (jurisdictionId) {
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: jurisdictionId },
      select: { scraperConfig: true },
    });

    if (jurisdiction?.scraperConfig) {
      return jurisdiction.scraperConfig as unknown as CourtSiteConfig;
    }
  }

  // 2. Check hardcoded federal courts
  for (const [key, config] of Object.entries(FEDERAL_COURT_SITES)) {
    if (hostname.includes(key) || hostname.includes(config.baseUrl.replace('https://', '').replace('www.', ''))) {
      return config;
    }
  }

  // 3. Check hardcoded state courts
  for (const [key, config] of Object.entries(STATE_COURT_SITES)) {
    if (hostname.includes(key) || hostname.includes(config.baseUrl.replace('https://', '').replace('www.', ''))) {
      return config;
    }
  }

  // 4. Trigger AI discovery for unknown sites
  if (jurisdictionId) {
    return await getScrapingStrategy(url, jurisdictionId);
  }

  // 5. Ultimate fallback to generic config
  return {
    ...GENERIC_CONFIG,
    baseUrl: `${new URL(url).protocol}//${new URL(url).hostname}`,
  };
}

/**
 * Common patterns for identifying rule content in HTML
 */
export const RULE_PATTERNS = {
  ruleCode: /(?:Rule|Local Rule|L\.R\.|Civ\.R\.|FRCP|FRAP)\s*(\d+(?:\.\d+)?(?:\([a-z]\))?)/i,
  deadline: /(\d+)\s*(?:day|days|hours?|business days?)/i,
  trigger: /(?:upon|after|following|within)\s+(?:the\s+)?(?:filing|service|entry|receipt)/i,
};
