import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the watchtower scheduling logic
// We test the scheduling/frequency filtering logic without hitting real APIs

describe('Watchtower Service', () => {
  describe('Frequency Filtering', () => {
    // Mock jurisdiction data
    const mockJurisdictions = [
      { id: '1', name: 'Daily Jurisdiction', syncFrequency: 'DAILY', autoSyncEnabled: true },
      { id: '2', name: 'Weekly Jurisdiction', syncFrequency: 'WEEKLY', autoSyncEnabled: true },
      { id: '3', name: 'Manual Jurisdiction', syncFrequency: 'MANUAL_ONLY', autoSyncEnabled: true },
      { id: '4', name: 'Disabled Jurisdiction', syncFrequency: 'DAILY', autoSyncEnabled: false },
    ];

    function filterJurisdictions(
      jurisdictions: typeof mockJurisdictions,
      frequency?: 'DAILY' | 'WEEKLY'
    ) {
      return jurisdictions.filter((j) => {
        if (!j.autoSyncEnabled) return false;
        if (frequency && j.syncFrequency !== frequency) return false;
        return true;
      });
    }

    it('should filter to only DAILY frequency jurisdictions', () => {
      const result = filterJurisdictions(mockJurisdictions, 'DAILY');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Daily Jurisdiction');
    });

    it('should filter to only WEEKLY frequency jurisdictions', () => {
      const result = filterJurisdictions(mockJurisdictions, 'WEEKLY');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Weekly Jurisdiction');
    });

    it('should return all auto-sync enabled jurisdictions when no frequency specified', () => {
      const result = filterJurisdictions(mockJurisdictions, undefined);

      expect(result).toHaveLength(3);
      expect(result.map((j) => j.name)).toContain('Daily Jurisdiction');
      expect(result.map((j) => j.name)).toContain('Weekly Jurisdiction');
      expect(result.map((j) => j.name)).toContain('Manual Jurisdiction');
    });

    it('should exclude disabled jurisdictions', () => {
      const result = filterJurisdictions(mockJurisdictions, undefined);

      expect(result.map((j) => j.name)).not.toContain('Disabled Jurisdiction');
    });

    it('should handle empty jurisdiction list', () => {
      const result = filterJurisdictions([], 'DAILY');

      expect(result).toHaveLength(0);
    });

    it('should handle all disabled jurisdictions', () => {
      const allDisabled = mockJurisdictions.map((j) => ({ ...j, autoSyncEnabled: false }));
      const result = filterJurisdictions(allDisabled, undefined);

      expect(result).toHaveLength(0);
    });
  });

  describe('Jitter Calculation', () => {
    // Test the jitter logic that prevents API overwhelming
    function calculateJitter(maxMs: number): number {
      return Math.floor(Math.random() * maxMs);
    }

    it('should generate jitter within bounds', () => {
      const maxJitter = 60000;

      for (let i = 0; i < 100; i++) {
        const jitter = calculateJitter(maxJitter);
        expect(jitter).toBeGreaterThanOrEqual(0);
        expect(jitter).toBeLessThan(maxJitter);
      }
    });

    it('should generate varied jitter values', () => {
      const maxJitter = 60000;
      const jitters = new Set<number>();

      for (let i = 0; i < 100; i++) {
        jitters.add(calculateJitter(maxJitter));
      }

      // Should have variety (not all same value)
      expect(jitters.size).toBeGreaterThan(10);
    });
  });

  describe('Content Hash Cleaning', () => {
    // Test the hash content cleaning that removes dynamic elements
    function cleanContentForHash(html: string): string {
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '') // ISO dates
        .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, '') // US dates
        .replace(/<!--[\s\S]*?-->/g, '') // Comments
        .replace(/\s+/g, ' ')
        .trim();
    }

    it('should remove script tags', () => {
      const html = '<div>content</div><script>alert("hi")</script><p>more</p>';
      const cleaned = cleanContentForHash(html);

      expect(cleaned).not.toContain('script');
      expect(cleaned).not.toContain('alert');
      expect(cleaned).toContain('content');
      expect(cleaned).toContain('more');
    });

    it('should remove style tags', () => {
      const html = '<div>content</div><style>.red { color: red; }</style>';
      const cleaned = cleanContentForHash(html);

      expect(cleaned).not.toContain('style');
      expect(cleaned).not.toContain('color');
    });

    it('should remove ISO dates', () => {
      const html = '<div>Updated: 2024-01-15T10:30:00</div>';
      const cleaned = cleanContentForHash(html);

      expect(cleaned).not.toContain('2024-01-15');
      expect(cleaned).toContain('Updated:');
    });

    it('should remove US dates', () => {
      const html = '<div>Updated: 1/15/2024 and 12/31/23</div>';
      const cleaned = cleanContentForHash(html);

      expect(cleaned).not.toContain('1/15/2024');
      expect(cleaned).not.toContain('12/31/23');
    });

    it('should remove HTML comments', () => {
      const html = '<div>content</div><!-- This is a comment --><p>more</p>';
      const cleaned = cleanContentForHash(html);

      expect(cleaned).not.toContain('comment');
      expect(cleaned).not.toContain('<!--');
    });

    it('should normalize whitespace', () => {
      const html = '<div>  content   with    spaces  </div>';
      const cleaned = cleanContentForHash(html);

      expect(cleaned).toBe('<div> content with spaces </div>');
    });

    it('should produce stable output for same semantic content', () => {
      const html1 = '<div>Rule 12</div>';
      const html2 = '<div>Rule 12</div>   '; // Extra whitespace

      const cleaned1 = cleanContentForHash(html1);
      const cleaned2 = cleanContentForHash(html2);

      expect(cleaned1).toBe(cleaned2);
    });
  });

  describe('Cron Schedule Validation', () => {
    // Test that our cron expressions are valid
    function isValidCronExpression(expr: string): boolean {
      const parts = expr.split(' ');
      if (parts.length !== 5) return false;

      // Basic validation: minute, hour, day of month, month, day of week
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      const isValidMinute = /^(\*|\d{1,2})$/.test(minute);
      const isValidHour = /^(\*|\d{1,2})$/.test(hour);
      const isValidDayOfMonth = /^(\*|\d{1,2})$/.test(dayOfMonth);
      const isValidMonth = /^(\*|\d{1,2})$/.test(month);
      const isValidDayOfWeek = /^(\*|\d{1})$/.test(dayOfWeek);

      return isValidMinute && isValidHour && isValidDayOfMonth && isValidMonth && isValidDayOfWeek;
    }

    it('should validate daily cron expression (6:00 AM UTC)', () => {
      const dailyCron = '0 6 * * *';
      expect(isValidCronExpression(dailyCron)).toBe(true);
    });

    it('should validate weekly cron expression (Sundays 3:00 AM UTC)', () => {
      const weeklyCron = '0 3 * * 0';
      expect(isValidCronExpression(weeklyCron)).toBe(true);
    });

    it('should reject invalid cron expressions', () => {
      expect(isValidCronExpression('invalid')).toBe(false);
      expect(isValidCronExpression('* * *')).toBe(false); // Too few parts
      expect(isValidCronExpression('* * * * * *')).toBe(false); // Too many parts
    });
  });
});
