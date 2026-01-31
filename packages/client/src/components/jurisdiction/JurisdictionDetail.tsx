import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Toggle } from '../ui/Toggle';
import { Select } from '../ui/Select';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useRulesStore } from '../../store/rulesStore';
import { useUIStore } from '../../store/uiStore';
import { JURISDICTION_STATUS_CONFIG, TRIGGER_TYPE_LABELS } from '@rulesharvester/shared';
import type { JurisdictionDNA, RuleTemplate, ScraperConfig } from '@rulesharvester/shared';
import { api } from '../../api/client';
import { toast } from '../ui/Toast';

interface WatchtowerResult {
  hasChanges: boolean;
  relevantUpdate: boolean;
  changeDescription?: string;
  contentHash: string;
}

export function JurisdictionDetail() {
  const { selectedJurisdiction, selectJurisdiction, updateSyncSettings, triggerDiscovery } = useJurisdictionsStore();
  const { rules } = useRulesStore();
  const { setActiveTab } = useUIStore();

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [watchtowerResult, setWatchtowerResult] = useState<WatchtowerResult | null>(null);
  const [showScraperDetails, setShowScraperDetails] = useState(false);

  if (!selectedJurisdiction) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Jurisdiction Selected</h2>
          <p className="text-text-secondary mb-4">Select a jurisdiction from the dashboard</p>
          <Button onClick={() => setActiveTab('dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const jurisdictionRules = rules.filter((r) => r.jurisdictionId === selectedJurisdiction.id);
  const dna = selectedJurisdiction.dna as JurisdictionDNA | undefined;
  const statusConfig = JURISDICTION_STATUS_CONFIG[selectedJurisdiction.status as keyof typeof JURISDICTION_STATUS_CONFIG];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Badge variant="info">{selectedJurisdiction.code}</Badge>
            <Badge
              variant={
                selectedJurisdiction.status === 'synced'
                  ? 'success'
                  : selectedJurisdiction.status === 'failed'
                  ? 'error'
                  : 'warning'
              }
            >
              {statusConfig?.label || selectedJurisdiction.status}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">{selectedJurisdiction.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => { selectJurisdiction(null); setActiveTab('dashboard'); }}>
            Back to Dashboard
          </Button>
          <Button onClick={() => setActiveTab('crawler')}>
            Extract More Rules
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* DNA Profile */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>Jurisdiction DNA</CardHeader>
          <CardContent>
            {dna ? (
              <div className="space-y-4">
                {/* Strictness Rating */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-secondary">Strictness Rating</span>
                    <span className="text-2xl font-bold text-amber-400">
                      {dna.strictnessRating}/10
                    </span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                      style={{ width: `${dna.strictnessRating * 10}%` }}
                    />
                  </div>
                </div>

                {/* Key Quirks */}
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-2">Key Quirks</p>
                  <div className="space-y-1">
                    {dna.keyQuirks.map((quirk: string, i: number) => (
                      <div key={i} className="text-sm p-2 bg-surface-elevated rounded">
                        {quirk}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pro Tip */}
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <p className="text-sm font-medium text-emerald-400 mb-1">Pro Tip</p>
                  <p className="text-sm text-text-secondary">{dna.proTip}</p>
                </div>

                {/* Common Traps */}
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-2">Common Traps</p>
                  <div className="space-y-1">
                    {dna.commonTraps.map((trap: string, i: number) => (
                      <div key={i} className="text-sm p-2 bg-rose-500/10 text-rose-400 rounded">
                        {trap}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historical Context */}
                {dna.historicalContext && (
                  <div>
                    <p className="text-sm font-medium text-text-secondary mb-2">Historical Context</p>
                    <p className="text-sm text-text-muted">{dna.historicalContext}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-text-muted mb-4">DNA profile not yet analyzed</p>
                <Button variant="secondary" size="sm">
                  Analyze DNA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rules List */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <span>Procedural Rules ({jurisdictionRules.length})</span>
            </div>
          </CardHeader>
          <CardContent>
            {jurisdictionRules.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-text-muted mb-4">No rules extracted yet</p>
                <Button onClick={() => setActiveTab('crawler')}>Start Extraction</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {jurisdictionRules.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Court Info */}
        <Card className="col-span-12">
          <CardHeader>Court Information</CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-text-secondary">Type</p>
                <p className="font-medium capitalize">
                  {selectedJurisdiction.type.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Court Website</p>
                {selectedJurisdiction.courtWebsite ? (
                  <a
                    href={selectedJurisdiction.courtWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:underline"
                  >
                    {selectedJurisdiction.courtWebsite}
                  </a>
                ) : (
                  <p className="text-text-muted">N/A</p>
                )}
              </div>
              <div>
                <p className="text-sm text-text-secondary">Last Synced</p>
                <p className="font-medium">
                  {selectedJurisdiction.lastSyncedAt
                    ? new Date(selectedJurisdiction.lastSyncedAt).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Settings */}
        <Card className="col-span-12">
          <CardHeader>Sync Settings</CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Auto-Sync Toggle */}
              <div className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg">
                <div>
                  <p className="font-medium">Auto-Sync</p>
                  <p className="text-sm text-text-muted">Automatically check for updates</p>
                </div>
                <Toggle
                  checked={selectedJurisdiction.autoSyncEnabled ?? false}
                  onChange={async (checked) => {
                    await updateSyncSettings(selectedJurisdiction.id, { autoSyncEnabled: checked });
                    toast.success(checked ? 'Auto-sync enabled' : 'Auto-sync disabled');
                  }}
                />
              </div>

              {/* Sync Frequency */}
              <div className="p-4 bg-surface-elevated rounded-lg">
                <Select
                  label="Sync Frequency"
                  value={selectedJurisdiction.syncFrequency ?? 'WEEKLY'}
                  options={[
                    { value: 'DAILY', label: 'Daily' },
                    { value: 'WEEKLY', label: 'Weekly' },
                    { value: 'MANUAL_ONLY', label: 'Manual Only' },
                  ]}
                  onChange={async (e) => {
                    await updateSyncSettings(selectedJurisdiction.id, { syncFrequency: e.target.value });
                    toast.success(`Sync frequency set to ${e.target.value.toLowerCase()}`);
                  }}
                  disabled={!selectedJurisdiction.autoSyncEnabled}
                />
              </div>

              {/* Discovery Button */}
              <div className="p-4 bg-surface-elevated rounded-lg">
                <p className="text-sm text-text-secondary mb-2">Cartographer</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (!selectedJurisdiction.courtWebsite) return;
                    setIsDiscovering(true);
                    try {
                      await triggerDiscovery(selectedJurisdiction.id, !!selectedJurisdiction.scraperConfig);
                      toast.success('Scraper selectors discovered');
                    } catch {
                      toast.error('Discovery failed');
                    } finally {
                      setIsDiscovering(false);
                    }
                  }}
                  disabled={!selectedJurisdiction.courtWebsite || isDiscovering}
                >
                  {isDiscovering ? 'Discovering...' : selectedJurisdiction.scraperConfig ? 'Re-discover' : 'Discover Selectors'}
                </Button>
                {selectedJurisdiction.scraperConfig && (
                  <button
                    onClick={() => setShowScraperDetails(!showScraperDetails)}
                    className="text-xs text-amber-400 mt-2 hover:underline"
                  >
                    {(selectedJurisdiction.scraperConfig as ScraperConfig).confidence ?? 100}% confidence
                    {showScraperDetails ? ' (hide)' : ' (details)'}
                  </button>
                )}
              </div>

              {/* Watchtower Check */}
              <div className="p-4 bg-surface-elevated rounded-lg">
                <p className="text-sm text-text-secondary mb-2">Watchtower</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (!selectedJurisdiction.courtWebsite) return;
                    setIsChecking(true);
                    setWatchtowerResult(null);
                    try {
                      const result = await api.post<WatchtowerResult>(
                        `/jurisdictions/${selectedJurisdiction.id}/check-updates`
                      );
                      setWatchtowerResult(result);
                      if (result.hasChanges) {
                        toast.info(result.relevantUpdate ? 'Relevant changes detected!' : 'Changes detected (not rule-related)');
                      } else {
                        toast.success('No changes detected');
                      }
                    } catch {
                      toast.error('Check failed');
                    } finally {
                      setIsChecking(false);
                    }
                  }}
                  disabled={!selectedJurisdiction.courtWebsite || isChecking}
                >
                  {isChecking ? 'Checking...' : 'Check for Updates'}
                </Button>
                {watchtowerResult && (
                  <div className="mt-2">
                    <Badge variant={watchtowerResult.hasChanges ? (watchtowerResult.relevantUpdate ? 'warning' : 'info') : 'success'}>
                      {watchtowerResult.hasChanges ? (watchtowerResult.relevantUpdate ? 'Updates Found' : 'Minor Changes') : 'No Changes'}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Scraper Config Details */}
            {showScraperDetails && selectedJurisdiction.scraperConfig && (
              <div className="mt-4 p-4 bg-surface rounded-lg border border-border">
                <h4 className="font-medium mb-3">Discovered CSS Selectors</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-text-muted">Rule List</p>
                    <code className="text-amber-400">{(selectedJurisdiction.scraperConfig as ScraperConfig).ruleListSelector}</code>
                  </div>
                  <div>
                    <p className="text-text-muted">Rule Links</p>
                    <code className="text-amber-400">{(selectedJurisdiction.scraperConfig as ScraperConfig).ruleLinkSelector}</code>
                  </div>
                  <div>
                    <p className="text-text-muted">Content Area</p>
                    <code className="text-amber-400">{(selectedJurisdiction.scraperConfig as ScraperConfig).ruleContentSelector}</code>
                  </div>
                  <div>
                    <p className="text-text-muted">Discovered At</p>
                    <span>{(selectedJurisdiction.scraperConfig as ScraperConfig).discoveredAt
                      ? new Date((selectedJurisdiction.scraperConfig as ScraperConfig).discoveredAt!).toLocaleString()
                      : 'Unknown'}</span>
                  </div>
                </div>
                {(selectedJurisdiction.scraperConfig as ScraperConfig).discoveryReasoning && (
                  <div className="mt-3 p-3 bg-surface-elevated rounded text-sm">
                    <p className="text-text-muted mb-1">AI Reasoning:</p>
                    <p className="text-text-secondary">{(selectedJurisdiction.scraperConfig as ScraperConfig).discoveryReasoning}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RuleRow({ rule }: { rule: RuleTemplate }) {
  const { setActiveTab } = useUIStore();
  const { fetchRuleById } = useRulesStore();

  const handleClick = async () => {
    await fetchRuleById(rule.id);
    setActiveTab('verify');
  };

  const triggerLabel = TRIGGER_TYPE_LABELS[rule.triggerType] || rule.triggerType;
  const deadlines = rule.deadlines as { id: string; name: string; daysFromTrigger: number; priority: string }[];

  return (
    <div
      onClick={handleClick}
      className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg hover:bg-border cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-4">
        <Badge variant="info">{rule.ruleCode}</Badge>
        <div>
          <p className="font-medium">{rule.name}</p>
          <p className="text-sm text-text-muted">{triggerLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium">{deadlines.length} deadlines</p>
          <p className="text-xs text-text-muted">
            {rule.confidenceScore}% confidence
          </p>
        </div>
        <Badge
          variant={
            rule.confidenceScore >= 80
              ? 'success'
              : rule.confidenceScore >= 60
              ? 'warning'
              : 'error'
          }
        >
          {rule.complexity || '-'}/10
        </Badge>
      </div>
    </div>
  );
}
