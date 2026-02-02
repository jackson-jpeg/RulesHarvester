import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { useRulesStore } from '../../store/rulesStore';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useUIStore } from '../../store/uiStore';
import { toast } from '../ui/Toast';
import { LogType } from '@rulesharvester/shared';

type ExportFormat = 'json' | 'csv' | 'yaml';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function ExportView() {
  const { rules } = useRulesStore();
  const { jurisdictions, groupedJurisdictions } = useJurisdictionsStore();
  const { addLog } = useUIStore();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Set<string>>(new Set());
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeRaw, setIncludeRaw] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  // Filter rules by selected jurisdictions (for display counts)
  const filteredRules = useMemo(() => {
    if (selectedJurisdictions.size === 0) return rules;
    return rules.filter(r => selectedJurisdictions.has(r.jurisdictionId));
  }, [rules, selectedJurisdictions]);

  // Build export URL with query params
  const buildExportUrl = useCallback((format: ExportFormat) => {
    const params = new URLSearchParams();
    params.set('format', format);
    params.set('includeMetadata', String(includeMetadata));
    params.set('includeRaw', String(includeRaw));
    if (selectedJurisdictions.size > 0) {
      params.set('jurisdictions', Array.from(selectedJurisdictions).join(','));
    }
    return `${API_BASE}/export?${params.toString()}`;
  }, [includeMetadata, includeRaw, selectedJurisdictions]);

  // Fetch preview (limited data)
  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const url = buildExportUrl(exportFormat);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch preview');
      }

      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const data = await response.json();
        // For JSON, show formatted preview
        const preview = data.data || data;
        setPreviewData(JSON.stringify(preview, null, 2));
      } else {
        // For CSV/YAML, show raw text
        const text = await response.text();
        setPreviewData(text);
      }
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewData('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  }, [buildExportUrl, exportFormat]);

  // Load preview when options change
  useEffect(() => {
    if (rules.length > 0) {
      fetchPreview();
    }
  }, [fetchPreview, rules.length]);

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const url = buildExportUrl(exportFormat);
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Get the blob
      const blob = await response.blob();

      // Create download link
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `rulesharvester-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      addLog(`Export downloaded: ${exportFormat.toUpperCase()}`, LogType.SUCCESS);
      toast.success(`Downloaded ${exportFormat.toUpperCase()} file`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      addLog(`Export failed: ${message}`, LogType.ERROR);
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!previewData) return;

    try {
      await navigator.clipboard.writeText(previewData);
      addLog('Export data copied to clipboard', LogType.SUCCESS);
      toast.success('Copied to clipboard');
    } catch {
      addLog('Failed to copy to clipboard', LogType.ERROR);
      toast.error('Failed to copy');
    }
  };

  // Extract metadata from preview for stats
  const exportMetadata = useMemo(() => {
    if (!previewData) return null;
    try {
      const data = JSON.parse(previewData);
      return data.system_metadata || null;
    } catch {
      return null;
    }
  }, [previewData]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Export Rules</h1>
          <p className="text-text-secondary">
            Download extracted rules via server-side export
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleCopy} disabled={!previewData}>
            Copy to Clipboard
          </Button>
          <Button
            onClick={handleDownload}
            disabled={filteredRules.length === 0 || isExporting}
            isLoading={isExporting}
          >
            Download {exportFormat.toUpperCase()}
          </Button>
        </div>
      </div>

      {/* Export Options */}
      <Card>
        <CardHeader>Export Options</CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Format Selection */}
            <div className="col-span-1 md:col-span-3">
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
            <div className="col-span-1 md:col-span-4">
              <p className="text-sm font-medium text-text-secondary mb-2">Options</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-surface-elevated accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-surface"
                  />
                  <span className="text-sm">Include AI metadata (DNA, risk, debate)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRaw}
                    onChange={(e) => setIncludeRaw(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-surface-elevated accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-surface"
                  />
                  <span className="text-sm">Include raw text</span>
                </label>
              </div>
            </div>

            {/* Selection Info */}
            <div className="col-span-1 md:col-span-5 flex items-end">
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
                  const isSelected = selectedJurisdictions.has(j.id);
                  return (
                    <button
                      key={j.id}
                      onClick={() => toggleJurisdiction(j.id)}
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${j.name} (${ruleCount} rules)`}
                      className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
                        isSelected
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
                  const isSelected = selectedJurisdictions.has(j.id);
                  return (
                    <button
                      key={j.id}
                      onClick={() => toggleJurisdiction(j.id)}
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${j.name} (${ruleCount} rules)`}
                      className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                        isSelected
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">
              {exportMetadata?.node_count ?? filteredRules.length}
            </p>
            <p className="text-sm text-text-secondary">
              {selectedJurisdictions.size === 0 ? 'Total Rules' : 'Selected Rules'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">
              {exportMetadata?.jurisdiction_count ??
                (selectedJurisdictions.size || [...new Set(filteredRules.map(r => r.jurisdictionId))].length)}
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
              {exportMetadata?.integrity_hash?.slice(0, 8) || '---'}
            </p>
            <p className="text-sm text-text-secondary">SHA-256 Hash</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>Export Preview (Server-Generated)</span>
            <div className="flex items-center gap-2">
              <Badge variant="info">{exportFormat.toUpperCase()}</Badge>
              {exportMetadata?.integrity_hash && (
                <Badge variant="success">SHA-256 Verified</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : filteredRules.length === 0 ? (
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
              {previewData || 'Loading...'}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
