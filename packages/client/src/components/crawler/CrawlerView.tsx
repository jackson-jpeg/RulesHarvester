import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useJobsStore } from '../../store/jobsStore';
import { useUIStore } from '../../store/uiStore';

export function CrawlerView() {
  const { jurisdictions, groupedJurisdictions } = useJurisdictionsStore();
  const { createJob } = useJobsStore();
  const { addLog } = useUIStore();

  const [selectedJurisdiction, setSelectedJurisdiction] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const jurisdictionOptions = jurisdictions.map((j) => ({
    value: j.id,
    label: `${j.name} (${j.code})`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
          <CardHeader>New Extraction</CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="Jurisdiction"
                options={jurisdictionOptions}
                placeholder="Select a jurisdiction..."
                value={selectedJurisdiction}
                onChange={(e) => setSelectedJurisdiction(e.target.value)}
              />

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
                Launch Extraction
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
                        onClick={() => setSelectedJurisdiction(j.id)}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${
                          selectedJurisdiction === j.id
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
                        onClick={() => setSelectedJurisdiction(j.id)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          selectedJurisdiction === j.id
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
                    onClick={() => setSelectedJurisdiction(j.id)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      selectedJurisdiction === j.id
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
