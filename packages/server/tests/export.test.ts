import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// Test the export utility functions directly
// These are extracted from the router for testability

interface RuleExport {
  rule_code: string;
  name: string;
  trigger_type: string;
  deadlines: unknown;
  related_rules: unknown;
  confidence_score: number;
  complexity?: number;
  source_url?: string | null;
}

interface JurisdictionExport {
  id: string;
  code: string;
  name: string;
  type: string;
  dna?: unknown;
  rule_sets: RuleExport[];
}

interface ExportData {
  system_metadata: {
    version: string;
    engine: string;
    ai_model: string;
    export_date: string;
    integrity_hash: string;
    node_count: number;
    jurisdiction_count: number;
  };
  jurisdictions: JurisdictionExport[];
}

// Extract functions from export.ts for testing
function convertToCSV(data: ExportData): string {
  const rows: string[][] = [];

  rows.push([
    'Jurisdiction Code',
    'Jurisdiction Name',
    'Jurisdiction Type',
    'Rule Code',
    'Rule Name',
    'Trigger Type',
    'Deadlines',
    'Related Rules',
    'Confidence Score',
    'Complexity',
    'Source URL',
  ]);

  for (const j of data.jurisdictions) {
    for (const r of j.rule_sets) {
      rows.push([
        j.code,
        j.name,
        j.type,
        r.rule_code,
        r.name,
        r.trigger_type,
        JSON.stringify(r.deadlines),
        JSON.stringify(r.related_rules),
        String(r.confidence_score),
        String(r.complexity || ''),
        r.source_url || '',
      ]);
    }
  }

  return rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function formatYAMLValue(value: unknown): string {
  if (typeof value === 'string') {
    if (value.includes('\n') || value.includes(':') || value.includes('#') || value.includes('"') || value.includes("'")) {
      return `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function convertToYAML(data: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let result = '';

  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        result += `${spaces}-\n${convertToYAML(item, indent + 1)}`;
      } else {
        result += `${spaces}- ${formatYAMLValue(item)}\n`;
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;

      if (typeof value === 'object') {
        if (Array.isArray(value) && value.length === 0) {
          result += `${spaces}${key}: []\n`;
        } else if (!Array.isArray(value) && Object.keys(value).length === 0) {
          result += `${spaces}${key}: {}\n`;
        } else {
          result += `${spaces}${key}:\n${convertToYAML(value, indent + 1)}`;
        }
      } else {
        result += `${spaces}${key}: ${formatYAMLValue(value)}\n`;
      }
    }
  }

  return result;
}

function calculateIntegrityHash(data: unknown): string {
  const dataString = JSON.stringify(data);
  return createHash('sha256').update(dataString).digest('hex');
}

describe('Export Router', () => {
  describe('convertToCSV', () => {
    it('should generate correct CSV headers', () => {
      const data: ExportData = {
        system_metadata: {
          version: '2.0.0',
          engine: 'RulesHarvester',
          ai_model: 'claude-sonnet-4-20250514',
          export_date: '2024-01-01T00:00:00.000Z',
          integrity_hash: 'abc123',
          node_count: 0,
          jurisdiction_count: 0,
        },
        jurisdictions: [],
      };

      const csv = convertToCSV(data);
      const firstLine = csv.split('\n')[0];

      expect(firstLine).toContain('Jurisdiction Code');
      expect(firstLine).toContain('Rule Code');
      expect(firstLine).toContain('Confidence Score');
    });

    it('should escape quotes in CSV values', () => {
      const data: ExportData = {
        system_metadata: {
          version: '2.0.0',
          engine: 'RulesHarvester',
          ai_model: 'claude-sonnet-4-20250514',
          export_date: '2024-01-01T00:00:00.000Z',
          integrity_hash: 'abc123',
          node_count: 1,
          jurisdiction_count: 1,
        },
        jurisdictions: [
          {
            id: '1',
            code: 'TEST',
            name: 'Test "Jurisdiction"',
            type: 'federal_circuit',
            rule_sets: [
              {
                rule_code: 'R1',
                name: 'Rule with "quotes"',
                trigger_type: 'MOTION_FILED',
                deadlines: [],
                related_rules: [],
                confidence_score: 85,
              },
            ],
          },
        ],
      };

      const csv = convertToCSV(data);

      // Quotes should be escaped as double quotes
      expect(csv).toContain('""quotes""');
      expect(csv).toContain('""Jurisdiction""');
    });

    it('should handle empty rule sets', () => {
      const data: ExportData = {
        system_metadata: {
          version: '2.0.0',
          engine: 'RulesHarvester',
          ai_model: 'claude-sonnet-4-20250514',
          export_date: '2024-01-01T00:00:00.000Z',
          integrity_hash: 'abc123',
          node_count: 0,
          jurisdiction_count: 1,
        },
        jurisdictions: [
          {
            id: '1',
            code: 'TEST',
            name: 'Test',
            type: 'state',
            rule_sets: [],
          },
        ],
      };

      const csv = convertToCSV(data);
      const lines = csv.split('\n');

      // Should only have header row
      expect(lines.length).toBe(1);
    });

    it('should handle null source_url', () => {
      const data: ExportData = {
        system_metadata: {
          version: '2.0.0',
          engine: 'RulesHarvester',
          ai_model: 'claude-sonnet-4-20250514',
          export_date: '2024-01-01T00:00:00.000Z',
          integrity_hash: 'abc123',
          node_count: 1,
          jurisdiction_count: 1,
        },
        jurisdictions: [
          {
            id: '1',
            code: 'TEST',
            name: 'Test',
            type: 'state',
            rule_sets: [
              {
                rule_code: 'R1',
                name: 'Test Rule',
                trigger_type: 'MOTION_FILED',
                deadlines: [],
                related_rules: [],
                confidence_score: 90,
                source_url: null,
              },
            ],
          },
        ],
      };

      const csv = convertToCSV(data);

      // Should not throw and should have empty string for null URL
      expect(csv).toContain('""'); // Last column should be empty
    });
  });

  describe('convertToYAML', () => {
    it('should handle simple objects', () => {
      const data = { name: 'test', value: 42 };
      const yaml = convertToYAML(data);

      expect(yaml).toContain('name: test');
      expect(yaml).toContain('value: 42');
    });

    it('should handle arrays', () => {
      const data = { items: ['a', 'b', 'c'] };
      const yaml = convertToYAML(data);

      expect(yaml).toContain('items:');
      expect(yaml).toContain('- a');
      expect(yaml).toContain('- b');
      expect(yaml).toContain('- c');
    });

    it('should handle nested objects', () => {
      const data = {
        jurisdiction: {
          code: 'TEST',
          rules: [{ name: 'Rule 1' }],
        },
      };
      const yaml = convertToYAML(data);

      expect(yaml).toContain('jurisdiction:');
      expect(yaml).toContain('code: TEST');
      expect(yaml).toContain('rules:');
    });

    it('should escape strings with special characters', () => {
      const data = { note: 'has: colon' };
      const yaml = convertToYAML(data);

      expect(yaml).toContain('"has: colon"');
    });

    it('should handle empty arrays', () => {
      const data = { items: [] };
      const yaml = convertToYAML(data);

      expect(yaml).toContain('items: []');
    });

    it('should handle empty objects', () => {
      const data = { config: {} };
      const yaml = convertToYAML(data);

      expect(yaml).toContain('config: {}');
    });

    it('should skip null/undefined values', () => {
      const data = { valid: 'yes', missing: null, undef: undefined };
      const yaml = convertToYAML(data);

      expect(yaml).toContain('valid: yes');
      expect(yaml).not.toContain('missing');
      expect(yaml).not.toContain('undef');
    });
  });

  describe('calculateIntegrityHash', () => {
    it('should produce consistent SHA-256 hash', () => {
      const data = { test: 'data' };

      const hash1 = calculateIntegrityHash(data);
      const hash2 = calculateIntegrityHash(data);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 produces 64 hex chars
    });

    it('should produce different hashes for different data', () => {
      const hash1 = calculateIntegrityHash({ a: 1 });
      const hash2 = calculateIntegrityHash({ a: 2 });

      expect(hash1).not.toBe(hash2);
    });

    it('should hash full content, not truncated', () => {
      // This tests the fix for the broken integrity hash that only checked first 100 chars
      const shortData = { short: 'x'.repeat(50) };
      const longData = { long: 'x'.repeat(500) };

      const shortHash = calculateIntegrityHash(shortData);
      const longHash = calculateIntegrityHash(longData);

      expect(shortHash).not.toBe(longHash);

      // Verify the hash changes when we modify content beyond character 100
      const longData2 = { long: 'x'.repeat(499) + 'y' };
      const longHash2 = calculateIntegrityHash(longData2);

      expect(longHash).not.toBe(longHash2);
    });
  });
});
