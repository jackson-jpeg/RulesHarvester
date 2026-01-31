import * as cheerio from 'cheerio';
import { getSiteConfig, RULE_PATTERNS, type CourtSiteConfig } from './courtSites.js';

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  ruleCode?: string;
  links: { href: string; text: string }[];
  metadata: {
    scrapedAt: Date;
    siteConfig: string;
    contentLength: number;
  };
}

export interface CrawlResult {
  baseUrl: string;
  pages: ScrapeResult[];
  errors: { url: string; error: string }[];
  metadata: {
    startedAt: Date;
    completedAt: Date;
    totalPages: number;
    successfulPages: number;
  };
}

class ScraperService {
  private async fetchHtml(url: string): Promise<string> {
    // Dynamic import of axios to avoid module resolution issues
    const axios = (await import('axios')).default;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'RulesHarvester/2.0 (Legal Research Bot; +https://rulesharvester.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000,
      maxRedirects: 5,
    });

    return response.data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Scrape a single URL for rule content
   */
  async scrapeUrl(url: string, jurisdictionId?: string): Promise<ScrapeResult> {
    const config = await getSiteConfig(url, jurisdictionId);
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    // Extract title
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

    // Extract main content using site-specific or fallback selectors
    let content = '';
    const contentSelectors = config.ruleContentSelector.split(', ');
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }

    // If no content found with specific selectors, get body text
    if (!content) {
      // Remove script/style elements
      $('script, style, nav, footer, header').remove();
      content = $('body').text().trim();
    }

    // Clean up content (remove excessive whitespace)
    content = content.replace(/\s+/g, ' ').trim();

    // Try to extract rule code
    let ruleCode: string | undefined;
    if (config.ruleCodeSelector) {
      const codeSelectors = config.ruleCodeSelector.split(', ');
      for (const selector of codeSelectors) {
        const text = $(selector).first().text().trim();
        const match = text.match(RULE_PATTERNS.ruleCode);
        if (match) {
          ruleCode = match[0];
          break;
        }
      }
    }

    // If no rule code found from selector, try to find in content
    if (!ruleCode) {
      const match = content.match(RULE_PATTERNS.ruleCode);
      if (match) {
        ruleCode = match[0];
      }
    }

    // Extract links for further crawling
    const links: { href: string; text: string }[] = [];
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        // Resolve relative URLs
        try {
          const absoluteUrl = new URL(href, url).href;
          links.push({ href: absoluteUrl, text });
        } catch {
          // Invalid URL, skip
        }
      }
    });

    return {
      url,
      title,
      content,
      ruleCode,
      links,
      metadata: {
        scrapedAt: new Date(),
        siteConfig: config.name,
        contentLength: content.length,
      },
    };
  }

  /**
   * Crawl a court website starting from a base URL
   * Discovers and scrapes rule pages
   */
  async crawlSite(
    baseUrl: string,
    options: { maxPages?: number; followLinks?: boolean; jurisdictionId?: string } = {}
  ): Promise<CrawlResult> {
    const { maxPages = 20, followLinks = true, jurisdictionId } = options;
    const config = await getSiteConfig(baseUrl, jurisdictionId);
    const startedAt = new Date();

    const pages: ScrapeResult[] = [];
    const errors: { url: string; error: string }[] = [];
    const visited = new Set<string>();
    const queue: string[] = [baseUrl];

    while (queue.length > 0 && pages.length < maxPages) {
      const url = queue.shift()!;

      // Skip if already visited
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        const result = await this.scrapeUrl(url, jurisdictionId);
        pages.push(result);

        // Add discovered links to queue if following links
        if (followLinks) {
          for (const link of result.links) {
            // Only follow links on the same domain
            if (
              link.href.includes(new URL(baseUrl).hostname) &&
              !visited.has(link.href) &&
              this.isLikelyRulePage(link)
            ) {
              queue.push(link.href);
            }
          }
        }

        // Respect rate limits
        await this.sleep(config.rateLimitMs);
      } catch (error) {
        errors.push({
          url,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      baseUrl,
      pages,
      errors,
      metadata: {
        startedAt,
        completedAt: new Date(),
        totalPages: pages.length + errors.length,
        successfulPages: pages.length,
      },
    };
  }

  /**
   * Check if a link is likely to lead to a rule page
   */
  private isLikelyRulePage(link: { href: string; text: string }): boolean {
    const href = link.href.toLowerCase();
    const text = link.text.toLowerCase();

    // Check URL patterns
    const urlPatterns = ['rule', 'local-rule', 'procedure', 'civil', 'criminal', 'appellate'];
    const hasUrlPattern = urlPatterns.some((p) => href.includes(p));

    // Check link text
    const textPatterns = ['rule', 'procedure', 'order', 'standing'];
    const hasTextPattern = textPatterns.some((p) => text.includes(p));

    // Exclude common non-rule pages
    const excludePatterns = ['login', 'contact', 'about', 'news', 'calendar', 'search', '.pdf', '.doc'];
    const hasExcludePattern = excludePatterns.some((p) => href.includes(p));

    return (hasUrlPattern || hasTextPattern) && !hasExcludePattern;
  }

  /**
   * Extract potential rules from scraped content
   */
  extractRuleCandidates(result: ScrapeResult): {
    ruleCode: string;
    snippet: string;
    relevanceScore: number;
  }[] {
    const candidates: { ruleCode: string; snippet: string; relevanceScore: number }[] = [];
    const content = result.content;

    // Find all rule code mentions
    const ruleMatches = content.matchAll(new RegExp(RULE_PATTERNS.ruleCode, 'gi'));

    for (const match of ruleMatches) {
      const ruleCode = match[0];
      const index = match.index || 0;

      // Extract surrounding context as snippet
      const start = Math.max(0, index - 100);
      const end = Math.min(content.length, index + 500);
      const snippet = content.slice(start, end).trim();

      // Calculate relevance score based on content quality
      let score = 50; // Base score

      // Boost if contains deadline language
      if (RULE_PATTERNS.deadline.test(snippet)) score += 20;

      // Boost if contains trigger language
      if (RULE_PATTERNS.trigger.test(snippet)) score += 15;

      // Boost if snippet is substantial
      if (snippet.length > 300) score += 10;

      // Penalize if too short
      if (snippet.length < 100) score -= 20;

      candidates.push({
        ruleCode,
        snippet,
        relevanceScore: Math.min(100, Math.max(0, score)),
      });
    }

    // Remove duplicates (same rule code)
    const seen = new Set<string>();
    return candidates.filter((c) => {
      if (seen.has(c.ruleCode)) return false;
      seen.add(c.ruleCode);
      return true;
    });
  }
}

export const scraperService = new ScraperService();
