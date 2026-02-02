/**
 * Export format conversion utilities
 */

interface RuleExport {
  rule_code: string;
  name: string;
  trigger_type: string;
  deadlines: unknown;
  related_rules: unknown;
  confidence_score: number;
  complexity?: number;
  risk_profile?: unknown;
  swarm_debate?: unknown;
  source_url?: string | null;
  raw_text?: string | null;
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

/**
 * Convert export data to CSV format
 */
export function convertToCSV(data: ExportData): string {
  const rows: string[][] = [];

  // Header
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

  // Data rows
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

/**
 * Format a single value for YAML output
 */
function formatYAMLValue(value: unknown): string {
  if (typeof value === 'string') {
    // Escape strings that need quoting
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

/**
 * Convert export data to YAML format
 */
export function convertToYAML(data: unknown, indent = 0): string {
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

// Re-export types for use in other files
export type { ExportData, JurisdictionExport, RuleExport };
