import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { useRulesStore } from '../../store/rulesStore';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useUIStore } from '../../store/uiStore';
import type { RuleTemplate } from '@rulesharvester/shared';

export function ExportView() {
  const { rules } = useRulesStore();
  const { jurisdictions } = useJurisdictionsStore();
  const { addLog } = useUIStore();
  const [copied, setCopied] = useState(false);

  const exportData = useMemo(() => {
    // Group rules by jurisdiction
    const rulesByJurisdiction = rules.reduce<Record<string, RuleTemplate[]>>((acc, rule) => {
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
        dna: j.dna,
        rule_sets: rulesByJurisdiction[j.id]?.map((r) => ({
          rule_code: r.ruleCode,
          name: r.name,
          trigger_type: r.triggerType,
          deadlines: r.deadlines,
          related_rules: r.relatedRules,
          confidence_score: r.confidenceScore,
          complexity: r.complexity,
          risk_profile: r.riskProfile,
          swarm_debate: r.swarmDebate,
          source_url: r.sourceUrl,
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
        node_count: rules.length,
        jurisdiction_count: jurisdictionData.length,
      },
      jurisdictions: jurisdictionData,
    };
  }, [rules, jurisdictions]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopied(true);
      addLog('Export data copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addLog('Failed to copy to clipboard', 'error');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rulesharvester-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('Export file downloaded', 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Export Rules</h1>
          <p className="text-text-secondary">Download extracted rules as JSON</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </Button>
          <Button onClick={handleDownload} disabled={rules.length === 0}>
            Download JSON
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">{rules.length}</p>
            <p className="text-sm text-text-secondary">Total Rules</p>
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
                rules.reduce((acc, r) => acc + r.confidenceScore, 0) / rules.length || 0
              )}%
            </p>
            <p className="text-sm text-text-secondary">Avg Confidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-purple-400">
              {(JSON.stringify(exportData).length / 1024).toFixed(1)}KB
            </p>
            <p className="text-sm text-text-secondary">Export Size</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>Export Preview</CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted mb-4">No rules to export</p>
              <p className="text-sm text-text-secondary">
                Extract some rules first using the Crawler
              </p>
            </div>
          ) : (
            <pre className="bg-surface-elevated p-4 rounded-lg overflow-auto max-h-[500px] text-sm font-mono text-text-secondary">
              {JSON.stringify(exportData, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
