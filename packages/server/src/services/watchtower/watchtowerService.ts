import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../index.js';

const anthropic = new Anthropic();

interface WatchtowerCheckResult {
  jurisdictionId: string;
  hasChanges: boolean;
  contentHash: string;
  previousHash?: string;
  relevantUpdate: boolean;
  changeDescription?: string;
}

/**
 * Watchtower: Smart change detection for court websites
 *
 * Instead of scraping everything, we:
 * 1. Fetch only "Recent Updates" or "News" page
 * 2. Hash the content
 * 3. Compare with previous hash
 * 4. If changed, ask AI if it's relevant to civil procedure
 * 5. Only trigger full scrape if relevant
 */
class WatchtowerService {
  /**
   * Check a single jurisdiction for updates
   */
  async checkForUpdates(jurisdictionId: string): Promise<WatchtowerCheckResult> {
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { id: jurisdictionId },
      select: {
        id: true,
        name: true,
        courtWebsite: true,
        scraperConfig: true,
      },
    });

    if (!jurisdiction?.courtWebsite) {
      throw new Error(`Jurisdiction ${jurisdictionId} has no court website`);
    }

    // Try to find updates/news page
    const updateUrls = this.getUpdateUrls(jurisdiction.courtWebsite);

    for (const url of updateUrls) {
      try {
        const result = await this.checkUrl(jurisdictionId, url);
        if (result) return result;
      } catch (error) {
        console.log(`Watchtower: Failed to check ${url}:`, error);
        continue;
      }
    }

    // Fallback: check main page
    const mainResult = await this.checkUrl(jurisdictionId, jurisdiction.courtWebsite);
    return mainResult || {
      jurisdictionId,
      hasChanges: false,
      contentHash: '',
      relevantUpdate: false,
    };
  }

  /**
   * Get potential update page URLs for a court website
   */
  private getUpdateUrls(baseUrl: string): string[] {
    const base = baseUrl.replace(/\/$/, '');
    return [
      `${base}/news`,
      `${base}/updates`,
      `${base}/announcements`,
      `${base}/recent-updates`,
      `${base}/rules-updates`,
      `${base}/local-rules`,
      `${base}/court-rules`,
    ];
  }

  /**
   * Check a specific URL for changes
   */
  private async checkUrl(
    jurisdictionId: string,
    url: string
  ): Promise<WatchtowerCheckResult | null> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'RulesHarvester/1.0 Watchtower' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const html = await response.text();
      const contentHash = this.hashContent(html);

      // Get previous hash from database
      const previousCheck = await this.getPreviousHash(jurisdictionId, url);

      if (previousCheck && previousCheck === contentHash) {
        // No changes
        return {
          jurisdictionId,
          hasChanges: false,
          contentHash,
          previousHash: previousCheck,
          relevantUpdate: false,
        };
      }

      // Content changed! Check if relevant
      const relevanceCheck = await this.checkRelevance(html, url);

      // Save new hash
      await this.saveContentHash(jurisdictionId, url, contentHash);

      return {
        jurisdictionId,
        hasChanges: true,
        contentHash,
        previousHash: previousCheck || undefined,
        relevantUpdate: relevanceCheck.isRelevant,
        changeDescription: relevanceCheck.description,
      };
    } catch (error) {
      console.error(`Watchtower: Error checking ${url}:`, error);
      return null;
    }
  }

  /**
   * Hash page content (ignoring dynamic elements)
   */
  private hashContent(html: string): string {
    // Remove common dynamic elements before hashing
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '') // ISO dates
      .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, '') // US dates
      .replace(/<!--[\s\S]*?-->/g, '') // Comments
      .replace(/\s+/g, ' ')
      .trim();

    return createHash('sha256').update(cleaned).digest('hex').slice(0, 16);
  }

  /**
   * Check if content changes are relevant to civil procedure rules
   */
  private async checkRelevance(
    html: string,
    url: string
  ): Promise<{ isRelevant: boolean; description?: string }> {
    // Extract text content (rough extraction)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000); // Limit for API

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-3-5-20241022',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `Analyze this court website update page and determine if it mentions changes to:
- Civil procedure rules
- Local rules
- Filing deadlines
- Court procedures
- Standing orders

URL: ${url}

Content:
${textContent}

Respond with JSON: {"isRelevant": boolean, "description": "brief description if relevant"}`,
        }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          isRelevant: result.isRelevant === true,
          description: result.description,
        };
      }
    } catch (error) {
      console.error('Watchtower: Relevance check failed:', error);
    }

    // Default to relevant if check fails (safer)
    return { isRelevant: true, description: 'Relevance check failed, flagged for review' };
  }

  /**
   * Get previous content hash from system logs
   */
  private async getPreviousHash(
    jurisdictionId: string,
    url: string
  ): Promise<string | null> {
    const log = await prisma.systemLog.findFirst({
      where: {
        type: 'INFO',
        message: `WATCHTOWER_HASH: ${jurisdictionId}`,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (log?.metadata) {
      const meta = log.metadata as { url?: string; hash?: string };
      if (meta.url === url) {
        return meta.hash || null;
      }
    }

    return null;
  }

  /**
   * Save content hash to system logs
   */
  private async saveContentHash(
    jurisdictionId: string,
    url: string,
    hash: string
  ): Promise<void> {
    await prisma.systemLog.create({
      data: {
        type: 'INFO',
        message: `WATCHTOWER_HASH: ${jurisdictionId}`,
        metadata: {
          jurisdictionId,
          url,
          hash,
          checkedAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Check all jurisdictions with auto-sync enabled
   */
  async runScheduledChecks(): Promise<WatchtowerCheckResult[]> {
    const jurisdictions = await prisma.jurisdiction.findMany({
      where: {
        autoSyncEnabled: true,
        courtWebsite: { not: null },
      },
      select: { id: true },
    });

    const results: WatchtowerCheckResult[] = [];

    for (const jurisdiction of jurisdictions) {
      try {
        const result = await this.checkForUpdates(jurisdiction.id);
        results.push(result);

        // Rate limit between checks
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Watchtower: Failed to check ${jurisdiction.id}:`, error);
      }
    }

    // Log summary
    const changesDetected = results.filter(r => r.hasChanges).length;
    const relevantChanges = results.filter(r => r.relevantUpdate).length;

    await prisma.systemLog.create({
      data: {
        type: 'INFO',
        message: `Watchtower scan complete: ${results.length} checked, ${changesDetected} changes, ${relevantChanges} relevant`,
        metadata: {
          totalChecked: results.length,
          changesDetected,
          relevantChanges,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return results;
  }
}

export const watchtowerService = new WatchtowerService();
