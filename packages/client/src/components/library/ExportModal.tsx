import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { toast } from '../ui/Toast';
import { useRulesStore } from '../../store/rulesStore';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useUIStore } from '../../store/uiStore';
import { LogType } from '@rulesharvester/shared';

type ExportFormat = 'json' | 'csv' | 'yaml';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
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

  const toggleJurisdiction = (id: string) => {
    setSelectedJurisdictions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedJurisdictions.size === jurisdictions.length) {
      setSelectedJurisdictions(new Set());
    } else {
      setSelectedJurisdictions(new Set(jurisdictions.map((j) => j.id)));
    }
  };

  const filteredRules = useMemo(() => {
    if (selectedJurisdictions.size === 0) return rules;
    return rules.filter((r) => selectedJurisdictions.has(r.jurisdictionId));
  }, [rules, selectedJurisdictions]);

  const buildExportUrl = useCallback(
    (format: ExportFormat) => {
      const params = new URLSearchParams();
      params.set('format', format);
      params.set('includeMetadata', String(includeMetadata));
      params.set('includeRaw', String(includeRaw));
      if (selectedJurisdictions.size > 0) {
        params.set('jurisdictions', Array.from(selectedJurisdictions).join(','));
      }
      return `${API_BASE}/export?${params.toString()}`;
    },
    [includeMetadata, includeRaw, selectedJurisdictions]
  );

  const fetchPreview = useCallback(async () => {
    if (!isOpen || rules.length === 0) return;
    setPreviewLoading(true);
    try {
      const url = buildExportUrl(exportFormat);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch preview');

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        const preview = data.data || data;
        // Limit preview size
        const previewStr = JSON.stringify(preview, null, 2);
        setPreviewData(previewStr.length > 5000 ? previewStr.slice(0, 5000) + '\n...' : previewStr);
      } else {
        const text = await response.text();
        setPreviewData(text.length > 5000 ? text.slice(0, 5000) + '\n...' : text);
      }
    } catch (error) {
      setPreviewData('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  }, [buildExportUrl, exportFormat, isOpen, rules.length]);

  useEffect(() => {
    if (isOpen && rules.length > 0) {
      fetchPreview();
    }
  }, [fetchPreview, isOpen, rules.length]);

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const url = buildExportUrl(exportFormat);
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      const blob = await response.blob();
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
      onClose();
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
      toast.error('Failed to copy');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <Card
        className="max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 id="export-modal-title" className="text-lg font-semibold">
              Export Rules
            </h2>
            <p className="text-sm text-text-secondary">
              {filteredRules.length} rules selected for export
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Format Selection */}
          <div>
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
          <div>
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

          {/* Jurisdiction Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-secondary">Filter by Jurisdiction</p>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedJurisdictions.size === jurisdictions.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-surface-elevated rounded-lg">
              {groupedJurisdictions &&
                [...groupedJurisdictions.federalCircuits, ...groupedJurisdictions.states].map((j) => {
                  const ruleCount = rules.filter((r) => r.jurisdictionId === j.id).length;
                  if (ruleCount === 0) return null;
                  const isSelected = selectedJurisdictions.has(j.id);
                  return (
                    <button
                      key={j.id}
                      onClick={() => toggleJurisdiction(j.id)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-black'
                          : 'bg-surface text-text-secondary hover:bg-border'
                      }`}
                    >
                      {j.code.replace(/^(FED-|ST-)/, '')} ({ruleCount})
                    </button>
                  );
                })}
            </div>
            <p className="text-xs text-text-muted mt-1">
              {selectedJurisdictions.size === 0
                ? 'Exporting all jurisdictions'
                : `Exporting ${selectedJurisdictions.size} jurisdiction(s)`}
            </p>
          </div>

          {/* Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-secondary">Preview</p>
              <Badge variant="info">{exportFormat.toUpperCase()}</Badge>
            </div>
            {previewLoading ? (
              <div className="flex items-center justify-center py-8 bg-surface-elevated rounded-lg">
                <Spinner size="sm" />
              </div>
            ) : (
              <pre className="bg-surface-elevated p-3 rounded-lg overflow-auto max-h-48 text-xs font-mono text-text-secondary">
                {previewData || 'No data to preview'}
              </pre>
            )}
          </div>
        </CardContent>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <div className="text-sm text-text-muted">
            {filteredRules.length} rules • {selectedJurisdictions.size || jurisdictions.length} jurisdictions
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleCopy} disabled={!previewData}>
              Copy to Clipboard
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleDownload} isLoading={isExporting} disabled={filteredRules.length === 0}>
              Download {exportFormat.toUpperCase()}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
