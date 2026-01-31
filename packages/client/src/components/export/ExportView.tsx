import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useRulesStore } from '../../store/rulesStore';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useUIStore } from '../../store/uiStore';
import { toast } from '../ui/Toast';
import type { RuleTemplate } from '@rulesharvester/shared';

type ExportFormat = 'json' | 'csv' | 'yaml';

export function ExportView() {
  const { rules } = useRulesStore();
  const { jurisdictions, groupedJurisdictions } = useJurisdictionsStore();
  const { addLog } = useUIStore();
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Set<string>>(new Set());
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeRaw, setIncludeRaw] = useState(false);

  // Toggle jurisdiction selection
  const toggleJurisdiction = (id: string) => {
    setSelectedJurisdictions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedJurisdictions.size === jurisdictions.length) {
      setSelectedJurisdictions(new Set());
    } else {
      setSelectedJurisdictions(new Set(jurisdictions.map(j => j.id)));
    }
  };

  // Filter rules by selected jurisdictions
  const filteredRules = useMemo(() => {
    if (selectedJurisdictions.size === 0) return rules;
    return rules.filter(r => selectedJurisdictions.has(r.jurisdictionId));
  }, [rules, selectedJurisdictions]);

  const exportData = useMemo(() => {
    // Group rules by jurisdiction
    const rulesByJurisdiction = filteredRules.reduce<Record<string, RuleTemplate[]>>((acc, rule) => {
      if (!acc[rule.jurisdictionId]) {
        acc[rule.jurisdictionId] = [];
      }
      acc[rule.jurisdictionId].push(rule);
      return acc;
    }, {});

    // Build export payload
    const jurisdictionData = jurisdictions
      .filter((j) => rulesByJurisdiction[j.id]?.length > 0)
      .map((j) => ({
        id: j.id,
        code: j.code,
        name: j.name,
        type: j.type,
        ...(includeMetadata && { dna: j.dna }),
        rule_sets: rulesByJurisdiction[j.id]?.map((r) => ({
          rule_code: r.ruleCode,
          name: r.name,
          trigger_type: r.triggerType,
          deadlines: r.deadlines,
          related_rules: r.relatedRules,
          confidence_score: r.confidenceScore,
          complexity: r.complexity,
          ...(includeMetadata && { risk_profile: r.riskProfile }),
          ...(includeMetadata && { swarm_debate: r.swarmDebate }),
          source_url: r.sourceUrl,
          ...(includeRaw && { raw_text: r.rawText }),
        })),
      }));

    // Generate integrity hash (simple hash for demo)
    const dataString = JSON.stringify(jurisdictionData);
    const hash = btoa(dataString.slice(0, 100)).slice(0, 16);

    return {
      system_metadata: {
        version: '2.0.0',
        engine: 'RulesHarvester',
        ai_model: 'claude-sonnet-4-20250514',
        export_date: new Date().toISOString(),
        integrity_hash: hash,
        node_count: filteredRules.length,
        jurisdiction_count: jurisdictionData.length,
      },
      jurisdictions: jurisdictionData,
    };
  }, [filteredRules, jurisdictions, includeMetadata, includeRaw]);

  // Convert to CSV format
  const convertToCSV = (data: typeof exportData) => {
    const rows: string[][] = [];

    // Header
    rows.push([
      'Jurisdiction Code',
      'Jurisdiction Name',
      'Rule Code',
      'Rule Name',
      'Trigger Type',
      'Deadlines',
      'Confidence Score',
      'Complexity',
      'Source URL',
    ]);

    // Data rows
    for (const j of data.jurisdictions) {
      for (const r of j.rule_sets || []) {
        rows.push([
          j.code,
          j.name,
          r.rule_code,
          r.name,
          r.trigger_type,
          JSON.stringify(r.deadlines),
          String(r.confidence_score),
          String(r.complexity || ''),
          r.source_url || '',
        ]);
      }
    }

    return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  };

  // Convert to YAML-like format (simple implementation)
  const convertToYAML = (data: unknown, indent = 0): string => {
    const spaces = '  '.repeat(indent);
    let result = '';

    if (Array.isArray(data)) {
      for (const item of data) {
        result += `${spaces}- `;
        if (typeof item === 'object' && item !== null) {
          result += '\n' + convertToYAML(item, indent + 1);
        } else {
          result += `${item}\n`;
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        result += `${spaces}${key}: `;
        if (typeof value === 'object' && value !== null) {
          result += '\n' + convertToYAML(value, indent + 1);
        } else if (typeof value === 'string' && value.includes('\n')) {
          result += `|\n${value.split('\n').map((l: string) => `${spaces}  ${l}`).join('\n')}\n`;
        } else {
          result += `${JSON.stringify(value)}\n`;
        }
      }
    } else {
      result = `${data}`;
    }

    return result;
  };

  // Get formatted export content
  const getExportContent = () => {
    switch (exportFormat) {
      case 'csv':
        return convertToCSV(exportData);
      case 'yaml':
        return convertToYAML(exportData);
      default:
        return JSON.stringify(exportData, null, 2);
    }
  };

  const getFileExtension = () => {
    switch (exportFormat) {
      case 'csv': return 'csv';
      case 'yaml': return 'yaml';
      default: return 'json';
    }
  };

  const getMimeType = () => {
    switch (exportFormat) {
      case 'csv': return 'text/csv';
      case 'yaml': return 'text/yaml';
      default: return 'application/json';
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getExportContent());
      setCopied(true);
      addLog('Export data copied to clipboard', 'success');
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addLog('Failed to copy to clipboard', 'error');
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const content = getExportContent();
    const blob = new Blob([content], { type: getMimeType() });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rulesharvester-export-${new Date().toISOString().split('T')[0]}.${getFileExtension()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('Export file downloaded', 'success');
    toast.success(`Downloaded ${getFileExtension().toUpperCase()} file`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Export Rules</h1>
          <p className="text-text-secondary">
            Download extracted rules in multiple formats
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </Button>
          <Button onClick={handleDownload} disabled={filteredRules.length === 0}>
            Download {exportFormat.toUpperCase()}
          </Button>
        </div>
      </div>

      {/* Export Options */}
      <Card>
        <CardHeader>Export Options</CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-6">
            {/* Format Selection */}
            <div className="col-span-3">
              <p className="text-sm font-medium text-text-secondary mb-2">Format</p>
              <div className="flex gap-2">
                {(['json', 'csv', 'yaml'] as ExportFormat[]).map((format) => (
                  <button
                    key={format}
                    onClick={() => setExportFormat(format)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exportFormat === format
                        ? 'bg-amber-500 text-black'
                        : 'bg-surface-elevated text-text-secondary hover:bg-border'
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="col-span-4">
              <p className="text-sm font-medium text-text-secondary mb-2">Options</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-surface-elevated accent-amber-500"
                  />
                  <span className="text-sm">Include AI metadata (DNA, risk, debate)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRaw}
                    onChange={(e) => setIncludeRaw(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-surface-elevated accent-amber-500"
                  />
                  <span className="text-sm">Include raw text</span>
                </label>
              </div>
            </div>

            {/* Selection Info */}
            <div className="col-span-5 flex items-end">
              <div className="flex items-center gap-4 w-full justify-end">
                <span className="text-sm text-text-muted">
                  {selectedJurisdictions.size === 0
                    ? 'Exporting all jurisdictions'
                    : `Exporting ${selectedJurisdictions.size} jurisdiction${selectedJurisdictions.size > 1 ? 's' : ''}`}
                </span>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedJurisdictions.size === jurisdictions.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jurisdiction Filter */}
      <Card>
        <CardHeader>Filter by Jurisdiction</CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {groupedJurisdictions && (
              <>
                {/* Federal */}
                {groupedJurisdictions.federalCircuits.map((j) => {
                  const ruleCount = rules.filter((r) => r.jurisdictionId === j.id).length;
                  if (ruleCount === 0) return null;
                  return (
                    <button
                      key={j.id}
                      onClick={() => toggleJurisdiction(j.id)}
                      className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
                        selectedJurisdictions.has(j.id)
                          ? 'bg-amber-500 text-black'
                          : 'bg-surface-elevated text-text-secondary hover:bg-border'
                      }`}
                    >
                      {j.code.replace('FED-', '')}
                      <Badge variant="default" className="text-xs">{ruleCount}</Badge>
                    </button>
                  );
                })}
                {/* States */}
                {groupedJurisdictions.states.map((j) => {
                  const ruleCount = rules.filter((r) => r.jurisdictionId === j.id).length;
                  if (ruleCount === 0) return null;
                  return (
                    <button
                      key={j.id}
                      onClick={() => toggleJurisdiction(j.id)}
                      className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                        selectedJurisdictions.has(j.id)
                          ? 'bg-amber-500 text-black'
                          : 'bg-surface-elevated text-text-secondary hover:bg-border'
                      }`}
                    >
                      {j.code.replace('ST-', '')}
                      <span className="opacity-60">({ruleCount})</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
          {rules.length === 0 && (
            <p className="text-center text-text-muted py-4">No rules extracted yet</p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">{filteredRules.length}</p>
            <p className="text-sm text-text-secondary">
              {selectedJurisdictions.size === 0 ? 'Total Rules' : 'Selected Rules'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">
              {exportData.jurisdictions.length}
            </p>
            <p className="text-sm text-text-secondary">Jurisdictions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-emerald-400">
              {Math.round(
                filteredRules.reduce((acc, r) => acc + r.confidenceScore, 0) / filteredRules.length || 0
              )}%
            </p>
            <p className="text-sm text-text-secondary">Avg Confidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-purple-400">
              {(getExportContent().length / 1024).toFixed(1)}KB
            </p>
            <p className="text-sm text-text-secondary">Export Size</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>Export Preview</span>
            <Badge variant="info">{exportFormat.toUpperCase()}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted mb-4">No rules to export</p>
              <p className="text-sm text-text-secondary">
                {rules.length === 0
                  ? 'Extract some rules first using the Crawler'
                  : 'Select jurisdictions to export'}
              </p>
            </div>
          ) : (
            <pre className="bg-surface-elevated p-4 rounded-lg overflow-auto max-h-[400px] text-sm font-mono text-text-secondary">
              {getExportContent()}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
