import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useJobsStore } from '../../store/jobsStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';

export function CrawlerView() {
  const { jurisdictions, groupedJurisdictions } = useJurisdictionsStore();
  const { createJob } = useJobsStore();
  const { addLog } = useUIStore();

  const [selectedJurisdiction, setSelectedJurisdiction] = useState('');
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const jurisdictionOptions = jurisdictions.map((j) => ({
    value: j.id,
    label: `${j.name} (${j.code})`,
  }));

  const toggleJurisdictionSelection = (jurisdictionId: string) => {
    setSelectedJurisdictions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jurisdictionId)) {
        newSet.delete(jurisdictionId);
      } else {
        newSet.add(jurisdictionId);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBulkMode) {
      // Bulk extraction
      if (selectedJurisdictions.size === 0) {
        addLog('Please select at least one jurisdiction', 'warn');
        return;
      }

      if (!sourceUrl && !rawText) {
        addLog('Please provide a source URL or paste rule text', 'warn');
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await api.post<{ jobsCreated: number }>('/bulk/extract', {
          jurisdictionIds: Array.from(selectedJurisdictions),
          sourceUrl: sourceUrl || undefined,
          rawText: rawText || undefined,
        });
        addLog(`Created ${result.jobsCreated} extraction jobs`, 'success');
        setSourceUrl('');
        setRawText('');
        setSelectedJurisdictions(new Set());
      } catch (error) {
        addLog(`Failed to create bulk jobs: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Single extraction
      if (!selectedJurisdiction) {
        addLog('Please select a jurisdiction', 'warn');
        return;
      }

      if (!sourceUrl && !rawText) {
        addLog('Please provide a source URL or paste rule text', 'warn');
        return;
      }

      setIsSubmitting(true);
      try {
        await createJob(selectedJurisdiction, sourceUrl || 'manual-entry', rawText || undefined);
        addLog(`Extraction job created for ${selectedJurisdiction}`, 'success');
        setSourceUrl('');
        setRawText('');
      } catch (error) {
        addLog(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Rule Crawler</h1>
        <p className="text-text-secondary">Discover and extract procedural rules</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Extraction Form */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <span>New Extraction</span>
              <button
                type="button"
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedJurisdictions(new Set());
                  setSelectedJurisdiction('');
                }}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  isBulkMode
                    ? 'bg-amber-500 text-black'
                    : 'bg-surface-elevated text-text-secondary hover:bg-border'
                }`}
              >
                {isBulkMode ? 'Bulk Mode' : 'Single Mode'}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isBulkMode ? (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Selected Jurisdictions ({selectedJurisdictions.size})
                  </label>
                  <div className="p-3 bg-surface-elevated rounded-lg min-h-[42px]">
                    {selectedJurisdictions.size === 0 ? (
                      <span className="text-text-muted text-sm">Click jurisdictions below to select...</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {Array.from(selectedJurisdictions).map((id) => {
                          const j = jurisdictions.find((j) => j.id === id);
                          return j ? (
                            <button
                              key={id}
                              onClick={() => toggleJurisdictionSelection(id)}
                              className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 cursor-pointer"
                            >
                              {j.code} ×
                            </button>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Select
                  label="Jurisdiction"
                  options={jurisdictionOptions}
                  placeholder="Select a jurisdiction..."
                  value={selectedJurisdiction}
                  onChange={(e) => setSelectedJurisdiction(e.target.value)}
                />
              )}

              <Input
                label="Source URL"
                type="url"
                placeholder="https://www.courts.gov/rules/..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                helperText="URL of the court rules page"
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-surface text-text-muted">or</span>
                </div>
              </div>

              <Textarea
                label="Paste Rule Text"
                placeholder="Paste the rule text here..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />

              <Button type="submit" isLoading={isSubmitting} className="w-full">
                {isBulkMode
                  ? `Launch Bulk Extraction (${selectedJurisdictions.size})`
                  : 'Launch Extraction'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          {/* Federal Courts */}
          <Card>
            <CardHeader>Federal Courts</CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-2">Circuit Courts</h4>
                  <div className="flex flex-wrap gap-2">
                    {groupedJurisdictions?.federalCircuits.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => isBulkMode ? toggleJurisdictionSelection(j.id) : setSelectedJurisdiction(j.id)}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${
                          (isBulkMode ? selectedJurisdictions.has(j.id) : selectedJurisdiction === j.id)
                            ? 'bg-amber-500 text-black'
                            : j.status === 'synced'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-surface-elevated text-text-secondary hover:bg-border'
                        }`}
                      >
                        {j.code.replace('FED-', '')}
                        {j.ruleCount > 0 && (
                          <span className="ml-1 opacity-60">({j.ruleCount})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-2">District Courts</h4>
                  <div className="flex flex-wrap gap-2">
                    {groupedJurisdictions?.federalDistricts.slice(0, 12).map((j) => (
                      <button
                        key={j.id}
                        onClick={() => isBulkMode ? toggleJurisdictionSelection(j.id) : setSelectedJurisdiction(j.id)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          (isBulkMode ? selectedJurisdictions.has(j.id) : selectedJurisdiction === j.id)
                            ? 'bg-amber-500 text-black'
                            : j.status === 'synced'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-surface-elevated text-text-secondary hover:bg-border'
                        }`}
                      >
                        {j.code.replace('DIST-', '')}
                      </button>
                    ))}
                    {(groupedJurisdictions?.federalDistricts.length || 0) > 12 && (
                      <Badge variant="default">
                        +{(groupedJurisdictions?.federalDistricts.length || 0) - 12} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* States */}
          <Card>
            <CardHeader>State Courts</CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {groupedJurisdictions?.states.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => isBulkMode ? toggleJurisdictionSelection(j.id) : setSelectedJurisdiction(j.id)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      (isBulkMode ? selectedJurisdictions.has(j.id) : selectedJurisdiction === j.id)
                        ? 'bg-amber-500 text-black'
                        : j.status === 'synced'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-surface-elevated text-text-secondary hover:bg-border'
                    }`}
                  >
                    {j.code.replace('ST-', '')}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
