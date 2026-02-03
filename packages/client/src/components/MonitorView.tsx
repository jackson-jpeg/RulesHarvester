import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Spinner, Skeleton } from './ui/Spinner';
import { Tooltip } from './ui/Tooltip';
import { ViewErrorBoundary } from './ui/ViewErrorBoundary';
import { toast } from './ui/Toast';
import { useUIStore, type MonitorSubTab } from '../store/uiStore';
import { useJurisdictionsStore } from '../store/jurisdictionsStore';
import { useRulesStore } from '../store/rulesStore';
import { api } from '../api/client';
import { ConflictStatus, JurisdictionStatus, LogType } from '@rulesharvester/shared';
import type { RuleConflict } from '@rulesharvester/shared';

// === TYPES ===
interface WatchtowerJurisdiction {
  id: string;
  code: string;
  name: string;
  syncFrequency: string;
  lastSyncedAt: string | null;
}

interface WatchtowerScan {
  id: string;
  message: string;
  metadata: {
    totalChecked?: number;
    changesDetected?: number;
    relevantChanges?: number;
    frequency?: string;
    timestamp?: string;
  };
  createdAt: string;
}

interface WatchtowerChange {
  id: string;
  message: string;
  metadata: {
    jurisdictionId?: string;
    url?: string;
    hash?: string;
    checkedAt?: string;
  };
  createdAt: string;
}

interface WatchtowerStatus {
  enabledJurisdictions: number;
  jurisdictions: WatchtowerJurisdiction[];
  recentScans: WatchtowerScan[];
  recentChanges: WatchtowerChange[];
}

type FilterType = 'all' | 'unresolved' | 'resolved';

// === WATCHTOWER TAB ===
function WatchtowerTab() {
  const [status, setStatus] = useState<WatchtowerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<WatchtowerStatus>('/watchtower/status');
      setStatus(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch watchtower status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  const handleManualScan = async (frequency?: 'DAILY' | 'WEEKLY') => {
    try {
      setIsScanning(true);
      await api.post('/watchtower/scan', { frequency });
      toast.success('Watchtower scan started');
      scanTimeoutRef.current = setTimeout(() => {
        fetchStatus();
        setIsScanning(false);
      }, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start scan');
      setIsScanning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-rose-400 mb-4">{error}</p>
          <Button onClick={fetchStatus}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => handleManualScan()}
          disabled={isScanning}
          isLoading={isScanning}
        >
          Run Manual Scan
        </Button>
        <Button onClick={fetchStatus} variant="ghost">
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">{status?.enabledJurisdictions || 0}</p>
            <p className="text-sm text-text-secondary">Monitored</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">
              {status?.jurisdictions.filter((j) => j.syncFrequency === 'DAILY').length || 0}
            </p>
            <p className="text-sm text-text-secondary">Daily Checks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-purple-400">
              {status?.jurisdictions.filter((j) => j.syncFrequency === 'WEEKLY').length || 0}
            </p>
            <p className="text-sm text-text-secondary">Weekly Checks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-emerald-400">
              {status?.recentScans[0]?.metadata?.relevantChanges || 0}
            </p>
            <p className="text-sm text-text-secondary">Recent Changes</p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Info */}
      <Card>
        <CardHeader>Schedule</CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-surface-elevated rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Daily Scans</span>
                <Badge variant="info">6:00 AM UTC</Badge>
              </div>
              <p className="text-xs text-text-muted">Checks jurisdictions with DAILY sync frequency</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => handleManualScan('DAILY')}
                disabled={isScanning}
              >
                Run Now
              </Button>
            </div>
            <div className="p-4 bg-surface-elevated rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Weekly Scans</span>
                <Badge variant="info">Sundays 3:00 AM UTC</Badge>
              </div>
              <p className="text-xs text-text-muted">Checks jurisdictions with WEEKLY sync frequency</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => handleManualScan('WEEKLY')}
                disabled={isScanning}
              >
                Run Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitored Jurisdictions */}
      <Card>
        <CardHeader>Monitored Jurisdictions ({status?.enabledJurisdictions || 0})</CardHeader>
        <CardContent>
          {status?.jurisdictions.length === 0 ? (
            <p className="text-center text-text-muted py-8">
              No jurisdictions have auto-sync enabled.
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {status?.jurisdictions.map((j) => (
                <div key={j.id} className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="default">{j.code}</Badge>
                    <span className="text-sm">{j.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={j.syncFrequency === 'DAILY' ? 'info' : 'warning'}>{j.syncFrequency}</Badge>
                    <span className="text-xs text-text-muted">
                      {j.lastSyncedAt ? `Last: ${new Date(j.lastSyncedAt).toLocaleDateString()}` : 'Never synced'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Scans */}
      <Card>
        <CardHeader>Recent Scans</CardHeader>
        <CardContent>
          {status?.recentScans.length === 0 ? (
            <p className="text-center text-text-muted py-8">No scans recorded yet</p>
          ) : (
            <div className="space-y-2">
              {status?.recentScans.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={(scan.metadata.relevantChanges || 0) > 0 ? 'warning' : 'success'}>
                      {scan.metadata.frequency || 'manual'}
                    </Badge>
                    <div>
                      <p className="text-sm">{scan.message}</p>
                      <p className="text-xs text-text-muted">{new Date(scan.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-blue-400">{scan.metadata.totalChecked} checked</span>
                    <span className="text-amber-400">{scan.metadata.changesDetected} changes</span>
                    <span className="text-emerald-400">{scan.metadata.relevantChanges} relevant</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// === CONFLICTS TAB ===
function ConflictsTab() {
  const [conflicts, setConflicts] = useState<RuleConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('unresolved');
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const { addLog, setConflictCount } = useUIStore();

  useEffect(() => {
    fetchConflicts();
  }, []);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ items: RuleConflict[] }>('/conflicts');
      setConflicts(response.items || []);
      const unresolvedCount = (response.items || []).filter((c) => c.status === ConflictStatus.UNRESOLVED).length;
      setConflictCount(unresolvedCount);
    } catch (error) {
      addLog('Failed to fetch conflicts', LogType.ERROR);
      toast.error('Failed to load conflicts');
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (conflictId: string, resolution: 'accept' | 'override') => {
    try {
      const endpoint =
        resolution === 'accept' ? `/conflicts/${conflictId}/resolve` : `/conflicts/${conflictId}/override`;
      await api.post(endpoint, { resolvedBy: 'user' });
      setConflicts((prev) =>
        prev.map((c) =>
          c.id === conflictId
            ? { ...c, status: resolution === 'accept' ? ConflictStatus.RESOLVED : ConflictStatus.MANUAL_OVERRIDE }
            : c
        )
      );
      addLog(`Conflict ${resolution === 'accept' ? 'accepted' : 'overridden'}`, LogType.SUCCESS);
      toast.success(`Conflict ${resolution === 'accept' ? 'resolved' : 'overridden'}`);
      // Update conflict count
      const newUnresolvedCount = conflicts.filter(
        (c) => c.id !== conflictId && c.status === ConflictStatus.UNRESOLVED
      ).length;
      setConflictCount(newUnresolvedCount);
    } catch (error) {
      addLog('Failed to resolve conflict', LogType.ERROR);
      toast.error('Failed to resolve conflict');
    }
  };

  const handleBulkResolve = async () => {
    const unresolvedIds = conflicts.filter((c) => c.status === ConflictStatus.UNRESOLVED).map((c) => c.id);
    if (unresolvedIds.length === 0) return;

    if (!window.confirm(`Accept AI recommendations for ${unresolvedIds.length} conflicts?`)) return;

    const BATCH_SIZE = 3;
    let successCount = 0;

    for (let i = 0; i < unresolvedIds.length; i += BATCH_SIZE) {
      const batch = unresolvedIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((id) => api.post(`/conflicts/${id}/resolve`, { resolvedBy: 'user' }))
      );
      results.forEach((result, j) => {
        if (result.status === 'fulfilled') {
          successCount++;
          setConflicts((prev) =>
            prev.map((c) => (c.id === batch[j] ? { ...c, status: ConflictStatus.RESOLVED } : c))
          );
        }
      });
    }

    addLog(`Bulk resolve: ${successCount} conflicts resolved`, LogType.SUCCESS);
    toast.success(`${successCount} conflict(s) resolved`);
    setConflictCount(Math.max(0, conflicts.filter((c) => c.status === ConflictStatus.UNRESOLVED).length - successCount));
  };

  const unresolvedConflicts = conflicts.filter((c) => c.status === ConflictStatus.UNRESOLVED);
  const resolvedConflicts = conflicts.filter((c) => c.status !== ConflictStatus.UNRESOLVED);
  const displayedConflicts =
    filter === 'all' ? conflicts : filter === 'unresolved' ? unresolvedConflicts : resolvedConflicts;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-rose-400">{unresolvedConflicts.length}</p>
            <p className="text-sm text-text-secondary">Unresolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-emerald-400">
              {conflicts.filter((c) => c.status === ConflictStatus.RESOLVED).length}
            </p>
            <p className="text-sm text-text-secondary">Accepted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">
              {conflicts.filter((c) => c.status === ConflictStatus.MANUAL_OVERRIDE).length}
            </p>
            <p className="text-sm text-text-secondary">Overridden</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {unresolvedConflicts.length > 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={handleBulkResolve}>
            Accept All ({unresolvedConflicts.length})
          </Button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['unresolved', 'resolved', 'all'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {f} (
            {f === 'all' ? conflicts.length : f === 'unresolved' ? unresolvedConflicts.length : resolvedConflicts.length}
            )
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : displayedConflicts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-4 text-emerald-400">✓</div>
            <h2 className="text-xl font-semibold mb-2">
              {filter === 'unresolved' ? 'All Clear' : 'No Conflicts'}
            </h2>
            <p className="text-text-secondary">
              {filter === 'unresolved' ? 'No unresolved conflicts detected' : 'No conflicts match this filter'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayedConflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              isExpanded={expandedConflict === conflict.id}
              onToggleExpand={() => setExpandedConflict(expandedConflict === conflict.id ? null : conflict.id)}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ConflictCardProps {
  conflict: RuleConflict;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onResolve: (id: string, resolution: 'accept' | 'override') => void;
}

function ConflictCard({ conflict, isExpanded, onToggleExpand, onResolve }: ConflictCardProps) {
  const isResolved = conflict.status !== ConflictStatus.UNRESOLVED;

  return (
    <Card className={isResolved ? 'opacity-60' : ''}>
      <CardContent>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant={
                  conflict.status === ConflictStatus.RESOLVED
                    ? 'success'
                    : conflict.status === ConflictStatus.MANUAL_OVERRIDE
                    ? 'warning'
                    : 'error'
                }
              >
                {conflict.status === ConflictStatus.RESOLVED
                  ? 'Resolved'
                  : conflict.status === ConflictStatus.MANUAL_OVERRIDE
                  ? 'Overridden'
                  : 'Conflict'}
              </Badge>
              <span className="text-sm text-text-muted">
                {conflict.ruleACode} vs {conflict.ruleBCode}
              </span>
            </div>
            <h3 className="font-semibold">{conflict.discrepancy}</h3>
          </div>
          <button
            onClick={onToggleExpand}
            className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* AI Recommendation */}
        <div className="p-3 bg-purple-500/10 rounded-lg mb-4 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <p className="text-sm font-medium text-purple-400">AI Recommendation</p>
          </div>
          <p className="text-sm text-text-secondary">{conflict.aiResolutionRecommendation}</p>
        </div>

        {isExpanded && (
          <div className="mb-4 p-3 bg-surface rounded-lg border border-border">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Rule A: </span>
                <Badge variant="info">{conflict.ruleACode}</Badge>
              </div>
              <div>
                <span className="text-text-muted">Rule B: </span>
                <Badge variant="info">{conflict.ruleBCode}</Badge>
              </div>
            </div>
          </div>
        )}

        {!isResolved && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onResolve(conflict.id, 'override')}>
              Manual Override
            </Button>
            <Button onClick={() => onResolve(conflict.id, 'accept')}>Accept Recommendation</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// === COVERAGE TAB ===
function CoverageTab() {
  const { groupedJurisdictions, selectJurisdiction } = useJurisdictionsStore();
  const { rules } = useRulesStore();
  const { setActiveTab } = useUIStore();

  const getRuleCount = (jurisdictionId: string) => {
    return rules.filter((r) => r.jurisdictionId === jurisdictionId).length;
  };

  const getLastSync = (lastSyncedAt?: Date | string | null) => {
    if (!lastSyncedAt) return 'Never synced';
    return new Date(lastSyncedAt).toLocaleDateString();
  };

  const handleJurisdictionClick = (jurisdictionId: string) => {
    const all = groupedJurisdictions
      ? [...groupedJurisdictions.federalCircuits, ...groupedJurisdictions.federalDistricts, ...groupedJurisdictions.states]
      : [];
    const jurisdiction = all.find((j) => j.id === jurisdictionId);
    if (jurisdiction) {
      selectJurisdiction(jurisdiction);
      // Navigate to library with jurisdiction filter
      setActiveTab('library');
    }
  };

  if (!groupedJurisdictions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalJurisdictions =
    groupedJurisdictions.federalCircuits.length +
    groupedJurisdictions.federalDistricts.length +
    groupedJurisdictions.states.length;
  const syncedCount = [
    ...groupedJurisdictions.federalCircuits,
    ...groupedJurisdictions.federalDistricts,
    ...groupedJurisdictions.states,
  ].filter((j) => j.status === JurisdictionStatus.SYNCED).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">{totalJurisdictions}</p>
            <p className="text-sm text-text-secondary">Total Jurisdictions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-emerald-400">{syncedCount}</p>
            <p className="text-sm text-text-secondary">Synced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">{rules.length}</p>
            <p className="text-sm text-text-secondary">Total Rules</p>
          </CardContent>
        </Card>
      </div>

      {/* Jurisdiction Mesh */}
      <Card>
        <CardHeader>Jurisdictional Mesh</CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Federal Circuits */}
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2">Federal Circuits</h4>
              <div className="flex flex-wrap gap-2">
                {groupedJurisdictions.federalCircuits.map((j) => {
                  const ruleCount = getRuleCount(j.id);
                  const tooltipContent = (
                    <div className="text-left">
                      <p className="font-medium">{j.name}</p>
                      <p className="text-text-muted">{ruleCount} rules</p>
                      <p className="text-text-muted">Last sync: {getLastSync(j.lastSyncedAt)}</p>
                      <p className="text-text-muted capitalize">Status: {j.status.toLowerCase()}</p>
                    </div>
                  );
                  return (
                    <Tooltip key={j.id} content={tooltipContent} position="top">
                      <button
                        onClick={() => handleJurisdictionClick(j.id)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          j.status === JurisdictionStatus.SYNCED
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : j.status === JurisdictionStatus.HARVESTING || j.status === JurisdictionStatus.SEARCHING
                            ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                            : j.status === JurisdictionStatus.FAILED
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-surface-elevated text-text-secondary hover:bg-border'
                        }`}
                      >
                        {j.code.replace('FED-', '')}
                        {ruleCount > 0 && <span className="ml-1 text-xs opacity-75">({ruleCount})</span>}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            {/* Federal Districts */}
            {groupedJurisdictions.federalDistricts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-2">Federal Districts</h4>
                <div className="flex flex-wrap gap-2">
                  {groupedJurisdictions.federalDistricts.map((j) => {
                    const ruleCount = getRuleCount(j.id);
                    return (
                      <button
                        key={j.id}
                        onClick={() => handleJurisdictionClick(j.id)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          j.status === JurisdictionStatus.SYNCED
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-surface-elevated text-text-secondary hover:bg-border'
                        }`}
                      >
                        {j.code.replace('DIST-', '')}
                        {ruleCount > 0 && <span className="ml-1 opacity-75">({ruleCount})</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* States */}
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2">States</h4>
              <div className="flex flex-wrap gap-2">
                {groupedJurisdictions.states.map((j) => {
                  const ruleCount = getRuleCount(j.id);
                  const tooltipContent = (
                    <div className="text-left">
                      <p className="font-medium">{j.name}</p>
                      <p className="text-text-muted">{ruleCount} rules</p>
                      <p className="text-text-muted">Last sync: {getLastSync(j.lastSyncedAt)}</p>
                      <p className="text-text-muted capitalize">Status: {j.status.toLowerCase()}</p>
                    </div>
                  );
                  return (
                    <Tooltip key={j.id} content={tooltipContent} position="bottom">
                      <button
                        onClick={() => handleJurisdictionClick(j.id)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          j.status === JurisdictionStatus.SYNCED
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : j.status === JurisdictionStatus.HARVESTING || j.status === JurisdictionStatus.SEARCHING
                            ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                            : j.status === JurisdictionStatus.FAILED
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-surface-elevated text-text-secondary hover:bg-border'
                        }`}
                      >
                        {j.code.replace('ST-', '')}
                        {ruleCount > 0 && <span className="ml-1 opacity-75">({ruleCount})</span>}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50" />
              <span className="text-text-secondary">Synced</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50" />
              <span className="text-text-secondary">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/50" />
              <span className="text-text-secondary">Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-surface-elevated border border-border" />
              <span className="text-text-secondary">Pending</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// === MAIN COMPONENT ===
function MonitorViewContent() {
  const { activeSubTab, setActiveSubTab, conflictCount } = useUIStore();
  const currentTab = (activeSubTab as MonitorSubTab) || 'watchtower';

  const tabs: { id: MonitorSubTab; label: string; badge?: number }[] = [
    { id: 'watchtower', label: 'Watchtower' },
    { id: 'conflicts', label: 'Conflicts', badge: conflictCount > 0 ? conflictCount : undefined },
    { id: 'coverage', label: 'Coverage' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Monitor</h1>
        <p className="text-text-secondary">Watch for changes, resolve conflicts, and view coverage</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={currentTab === tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              currentTab === tab.id
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {tab.badge && (
              <Badge variant="error" className="text-xs">
                {tab.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {currentTab === 'watchtower' && <WatchtowerTab />}
      {currentTab === 'conflicts' && <ConflictsTab />}
      {currentTab === 'coverage' && <CoverageTab />}
    </div>
  );
}

export function MonitorView() {
  return (
    <ViewErrorBoundary viewName="Monitor">
      <MonitorViewContent />
    </ViewErrorBoundary>
  );
}
