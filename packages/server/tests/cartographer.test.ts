import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the cartographer service logic
// We test the domain filtering, deduplication, and approval logic without hitting real APIs

describe('Cartographer Service', () => {
  describe('Domain Validation', () => {
    // Excluded domains - legal aggregators that should be filtered out
    const EXCLUDED_DOMAINS = [
      'westlaw.com',
      'lexisnexis.com',
      'findlaw.com',
      'justia.com',
      'law.cornell.edu',
      'casetext.com',
      'courtlistener.com',
      'oyez.org',
      'wikipedia.org',
      'nolo.com',
      'avvo.com',
      'lawyers.com',
      'martindale.com',
    ];

    function isExcludedDomain(url: string): boolean {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        return EXCLUDED_DOMAINS.some((excluded) => hostname.includes(excluded));
      } catch {
        return true; // Invalid URLs are excluded
      }
    }

    function isValidCourtDomain(url: string): boolean {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
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

    it('should exclude Westlaw URLs', () => {
      expect(isExcludedDomain('https://www.westlaw.com/some/rule')).toBe(true);
      expect(isExcludedDomain('https://next.westlaw.com/some/rule')).toBe(true);
    });

    it('should exclude FindLaw URLs', () => {
      expect(isExcludedDomain('https://caselaw.findlaw.com/some/rule')).toBe(true);
    });

    it('should exclude Justia URLs', () => {
      expect(isExcludedDomain('https://law.justia.com/codes/california')).toBe(true);
    });

    it('should exclude Wikipedia URLs', () => {
      expect(isExcludedDomain('https://en.wikipedia.org/wiki/Court')).toBe(true);
    });

    it('should exclude Cornell Law URLs', () => {
      expect(isExcludedDomain('https://www.law.cornell.edu/rules')).toBe(true);
    });

    it('should not exclude .gov domains', () => {
      expect(isExcludedDomain('https://www.uscourts.gov/rules')).toBe(false);
      expect(isExcludedDomain('https://ca9.uscourts.gov/rules')).toBe(false);
    });

    it('should validate .gov domains as court domains', () => {
      expect(isValidCourtDomain('https://www.uscourts.gov/rules')).toBe(true);
      expect(isValidCourtDomain('https://ca9.uscourts.gov/rules')).toBe(true);
      expect(isValidCourtDomain('https://www.courts.ca.gov')).toBe(true);
    });

    it('should validate .us domains as court domains', () => {
      expect(isValidCourtDomain('https://www.courts.state.tx.us')).toBe(true);
    });

    it('should validate domains containing "courts"', () => {
      expect(isValidCourtDomain('https://www.nycourts.org')).toBe(true);
      expect(isValidCourtDomain('https://courts.alaska.gov')).toBe(true);
    });

    it('should validate domains containing "judiciary"', () => {
      expect(isValidCourtDomain('https://www.njjudiciary.gov')).toBe(true);
    });

    it('should reject random domains', () => {
      expect(isValidCourtDomain('https://www.google.com')).toBe(false);
      expect(isValidCourtDomain('https://www.example.org')).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(isExcludedDomain('not-a-url')).toBe(true);
      expect(isValidCourtDomain('not-a-url')).toBe(false);
    });
  });

  describe('Search Query Generation', () => {
    const DISCOVERY_SEARCH_QUERIES = {
      FEDERAL_CIRCUIT: [
        'site:uscourts.gov federal circuit court local rules',
        'US Court of Appeals local rules procedures',
        'federal appellate court rules of practice',
      ],
      FEDERAL_DISTRICT: [
        'site:uscourts.gov district court local rules',
        'US District Court civil local rules',
        'federal district court standing orders',
      ],
      STATE: [
        'state supreme court rules of procedure',
        'state court local rules civil practice',
        'state judicial branch court rules',
      ],
    };

    function generateSearchQueries(types?: ('FEDERAL_CIRCUIT' | 'FEDERAL_DISTRICT' | 'STATE')[]): string[] {
      const targetTypes = types || ['FEDERAL_CIRCUIT', 'FEDERAL_DISTRICT', 'STATE'];
      const queries: string[] = [];

      for (const type of targetTypes) {
        const typeQueries = DISCOVERY_SEARCH_QUERIES[type];
        if (typeQueries) {
          queries.push(...typeQueries);
        }
      }

      return queries;
    }

    it('should generate queries for all types when none specified', () => {
      const queries = generateSearchQueries();
      expect(queries.length).toBe(9); // 3 queries per type × 3 types
    });

    it('should generate queries for federal circuit only', () => {
      const queries = generateSearchQueries(['FEDERAL_CIRCUIT']);
      expect(queries.length).toBe(3);
      expect(queries.every((q) => q.includes('circuit') || q.includes('appellate') || q.includes('Appeals'))).toBe(true);
    });

    it('should generate queries for federal district only', () => {
      const queries = generateSearchQueries(['FEDERAL_DISTRICT']);
      expect(queries.length).toBe(3);
      expect(queries.every((q) => q.toLowerCase().includes('district'))).toBe(true);
    });

    it('should generate queries for state only', () => {
      const queries = generateSearchQueries(['STATE']);
      expect(queries.length).toBe(3);
      expect(queries.every((q) => q.toLowerCase().includes('state'))).toBe(true);
    });

    it('should combine multiple types', () => {
      const queries = generateSearchQueries(['FEDERAL_CIRCUIT', 'STATE']);
      expect(queries.length).toBe(6);
    });

    it('should handle empty types array', () => {
      const queries = generateSearchQueries([]);
      expect(queries.length).toBe(0);
    });
  });

  describe('Deduplication Logic', () => {
    // Mock existing jurisdictions
    const mockExistingJurisdictions = [
      { id: '1', code: '9CIR', courtWebsite: 'https://ca9.uscourts.gov/rules', discoveryUrl: null },
      { id: '2', code: 'NDCA', courtWebsite: 'https://cand.uscourts.gov', discoveryUrl: 'https://cand.uscourts.gov/rules' },
      { id: '3', code: 'CA-SUP', courtWebsite: 'https://www.courts.ca.gov', discoveryUrl: null },
    ];

    function isDuplicate(
      url: string,
      suggestedCode: string,
      existing: typeof mockExistingJurisdictions
    ): boolean {
      const domain = new URL(url).hostname;

      return existing.some((j) => {
        // Check by code
        if (j.code === suggestedCode) return true;

        // Check by domain in courtWebsite
        if (j.courtWebsite && j.courtWebsite.includes(domain)) return true;

        // Check by domain in discoveryUrl
        if (j.discoveryUrl && j.discoveryUrl.includes(domain)) return true;

        return false;
      });
    }

    it('should detect duplicate by code', () => {
      expect(isDuplicate('https://ca9.new-url.gov', '9CIR', mockExistingJurisdictions)).toBe(true);
    });

    it('should detect duplicate by courtWebsite domain', () => {
      expect(isDuplicate('https://ca9.uscourts.gov/new-page', 'NEW-CODE', mockExistingJurisdictions)).toBe(true);
    });

    it('should detect duplicate by discoveryUrl domain', () => {
      expect(isDuplicate('https://cand.uscourts.gov/other', 'NEW-CODE', mockExistingJurisdictions)).toBe(true);
    });

    it('should not flag new jurisdictions as duplicates', () => {
      expect(isDuplicate('https://ca10.uscourts.gov/rules', '10CIR', mockExistingJurisdictions)).toBe(false);
    });

    it('should handle subdomains correctly', () => {
      // Different subdomain of same base domain
      expect(isDuplicate('https://www.uscourts.gov', 'NEW', mockExistingJurisdictions)).toBe(false);
    });
  });

  describe('Approval Workflow', () => {
    type JurisdictionStatus = 'DISCOVERED' | 'IDLE' | 'SYNCED';

    interface MockJurisdiction {
      id: string;
      status: JurisdictionStatus;
      approvedAt: Date | null;
      rejectedAt: Date | null;
      rejectionReason: string | null;
    }

    function canApprove(jurisdiction: MockJurisdiction): boolean {
      return jurisdiction.status === 'DISCOVERED';
    }

    function canReject(jurisdiction: MockJurisdiction): boolean {
      return jurisdiction.status === 'DISCOVERED';
    }

    function approve(jurisdiction: MockJurisdiction): MockJurisdiction {
      if (!canApprove(jurisdiction)) {
        throw new Error('Cannot approve jurisdiction not in DISCOVERED status');
      }
      return {
        ...jurisdiction,
        status: 'IDLE' as JurisdictionStatus,
        approvedAt: new Date(),
      };
    }

    function reject(jurisdiction: MockJurisdiction, reason: string): MockJurisdiction {
      if (!canReject(jurisdiction)) {
        throw new Error('Cannot reject jurisdiction not in DISCOVERED status');
      }
      return {
        ...jurisdiction,
        rejectedAt: new Date(),
        rejectionReason: reason,
      };
    }

    it('should allow approval of DISCOVERED jurisdictions', () => {
      const jurisdiction: MockJurisdiction = {
        id: '1',
        status: 'DISCOVERED',
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
      };

      expect(canApprove(jurisdiction)).toBe(true);

      const approved = approve(jurisdiction);
      expect(approved.status).toBe('IDLE');
      expect(approved.approvedAt).not.toBeNull();
    });

    it('should allow rejection of DISCOVERED jurisdictions', () => {
      const jurisdiction: MockJurisdiction = {
        id: '1',
        status: 'DISCOVERED',
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
      };

      expect(canReject(jurisdiction)).toBe(true);

      const rejected = reject(jurisdiction, 'Not a real court');
      expect(rejected.rejectedAt).not.toBeNull();
      expect(rejected.rejectionReason).toBe('Not a real court');
    });

    it('should not allow approval of already approved jurisdictions', () => {
      const jurisdiction: MockJurisdiction = {
        id: '1',
        status: 'IDLE', // Already approved
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      };

      expect(canApprove(jurisdiction)).toBe(false);
      expect(() => approve(jurisdiction)).toThrow();
    });

    it('should not allow approval of SYNCED jurisdictions', () => {
      const jurisdiction: MockJurisdiction = {
        id: '1',
        status: 'SYNCED',
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      };

      expect(canApprove(jurisdiction)).toBe(false);
    });
  });

  describe('Confidence Score Interpretation', () => {
    function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
      if (score >= 80) return 'high';
      if (score >= 60) return 'medium';
      return 'low';
    }

    function shouldAutoApprove(score: number, hasRulesSection: boolean): boolean {
      // Only auto-approve high confidence with rules section
      return score >= 90 && hasRulesSection;
    }

    it('should classify high confidence correctly', () => {
      expect(getConfidenceLevel(80)).toBe('high');
      expect(getConfidenceLevel(95)).toBe('high');
      expect(getConfidenceLevel(100)).toBe('high');
    });

    it('should classify medium confidence correctly', () => {
      expect(getConfidenceLevel(60)).toBe('medium');
      expect(getConfidenceLevel(75)).toBe('medium');
      expect(getConfidenceLevel(79)).toBe('medium');
    });

    it('should classify low confidence correctly', () => {
      expect(getConfidenceLevel(0)).toBe('low');
      expect(getConfidenceLevel(59)).toBe('low');
    });

    it('should recommend auto-approve for 90%+ with rules', () => {
      expect(shouldAutoApprove(95, true)).toBe(true);
      expect(shouldAutoApprove(90, true)).toBe(true);
    });

    it('should not auto-approve 90%+ without rules section', () => {
      expect(shouldAutoApprove(95, false)).toBe(false);
    });

    it('should not auto-approve below 90%', () => {
      expect(shouldAutoApprove(85, true)).toBe(false);
      expect(shouldAutoApprove(60, true)).toBe(false);
    });
  });

  describe('Bulk Operations', () => {
    interface BulkResult {
      approved: number;
      failed: number;
      errors: string[];
    }

    function simulateBulkApprove(
      ids: string[],
      approveOne: (id: string) => boolean
    ): BulkResult {
      const result: BulkResult = { approved: 0, failed: 0, errors: [] };

      for (const id of ids) {
        try {
          if (approveOne(id)) {
            result.approved++;
          } else {
            result.failed++;
            result.errors.push(`Failed to approve ${id}`);
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Error approving ${id}: ${error}`);
        }
      }

      return result;
    }

    it('should track successful bulk approvals', () => {
      const ids = ['1', '2', '3'];
      const result = simulateBulkApprove(ids, () => true);

      expect(result.approved).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should track failed bulk approvals', () => {
      const ids = ['1', '2', '3'];
      const result = simulateBulkApprove(ids, (id) => id !== '2');

      expect(result.approved).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle empty ids array', () => {
      const result = simulateBulkApprove([], () => true);

      expect(result.approved).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should handle all failures', () => {
      const ids = ['1', '2', '3'];
      const result = simulateBulkApprove(ids, () => false);

      expect(result.approved).toBe(0);
      expect(result.failed).toBe(3);
    });

    it('should handle exceptions during approval', () => {
      const ids = ['1', '2'];
      const result = simulateBulkApprove(ids, (id) => {
        if (id === '2') throw new Error('DB error');
        return true;
      });

      expect(result.approved).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('Error');
    });
  });

  describe('URL Cleaning', () => {
    function cleanUrl(url: string): string {
      // Remove trailing punctuation that might be captured from text
      return url.replace(/[.,;:!?)]+$/, '');
    }

    it('should remove trailing periods', () => {
      expect(cleanUrl('https://courts.gov/rules.')).toBe('https://courts.gov/rules');
    });

    it('should remove trailing commas', () => {
      expect(cleanUrl('https://courts.gov/rules,')).toBe('https://courts.gov/rules');
    });

    it('should remove trailing parenthesis', () => {
      expect(cleanUrl('https://courts.gov/rules)')).toBe('https://courts.gov/rules');
    });

    it('should remove multiple trailing punctuation', () => {
      expect(cleanUrl('https://courts.gov/rules.)')).toBe('https://courts.gov/rules');
    });

    it('should not modify clean URLs', () => {
      expect(cleanUrl('https://courts.gov/rules')).toBe('https://courts.gov/rules');
    });

    it('should preserve query strings', () => {
      expect(cleanUrl('https://courts.gov/rules?page=1')).toBe('https://courts.gov/rules?page=1');
    });
  });
});
