import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Spinner';
import { api } from '../../api/client';
import { useUIStore } from '../../store/uiStore';
import { toast } from '../ui/Toast';
import type { RuleConflict } from '@rulesharvester/shared';
import { ConflictStatus } from '@rulesharvester/shared';

type FilterType = 'all' | 'unresolved' | 'resolved';

export function ConflictView() {
  const [conflicts, setConflicts] = useState<RuleConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('unresolved');
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const { addLog } = useUIStore();

  useEffect(() => {
    fetchConflicts();
  }, []);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ items: RuleConflict[] }>('/conflicts');
      setConflicts(response.items || []);
    } catch (error) {
      addLog('Failed to fetch conflicts', 'error');
      toast.error('Failed to load conflicts');
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (conflictId: string, resolution: 'accept' | 'override') => {
    try {
      const endpoint = resolution === 'accept' ? `/conflicts/${conflictId}/resolve` : `/conflicts/${conflictId}/override`;
      await api.post(endpoint, { resolvedBy: 'user' });
      setConflicts((prev) =>
        prev.map((c) =>
          c.id === conflictId
            ? { ...c, status: resolution === 'accept' ? ConflictStatus.RESOLVED : ConflictStatus.MANUAL_OVERRIDE }
            : c
        )
      );
      addLog(`Conflict ${resolution === 'accept' ? 'accepted' : 'overridden'}`, 'success');
      toast.success(`Conflict ${resolution === 'accept' ? 'resolved' : 'overridden'}`);
    } catch (error) {
      addLog('Failed to resolve conflict', 'error');
      toast.error('Failed to resolve conflict');
    }
  };

  const handleBulkResolve = async () => {
    const unresolvedIds = conflicts
      .filter((c) => c.status === ConflictStatus.UNRESOLVED)
      .map((c) => c.id);

    if (unresolvedIds.length === 0) return;

    if (!window.confirm(`Accept AI recommendations for ${unresolvedIds.length} conflicts?`)) {
      return;
    }

    for (const id of unresolvedIds) {
      await handleResolve(id, 'accept');
    }
  };

  const unresolvedConflicts = conflicts.filter((c) => c.status === ConflictStatus.UNRESOLVED);
  const resolvedConflicts = conflicts.filter((c) => c.status !== ConflictStatus.UNRESOLVED);

  const displayedConflicts =
    filter === 'all'
      ? conflicts
      : filter === 'unresolved'
      ? unresolvedConflicts
      : resolvedConflicts;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conflict Resolution</h1>
          <p className="text-text-secondary">
            {unresolvedConflicts.length} unresolved, {resolvedConflicts.length} resolved
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unresolvedConflicts.length > 0 && (
            <Button variant="secondary" onClick={handleBulkResolve}>
              Accept All ({unresolvedConflicts.length})
            </Button>
          )}
          <Button onClick={fetchConflicts} isLoading={loading}>
            Refresh
          </Button>
        </div>
      </div>

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
            {f} ({f === 'all' ? conflicts.length : f === 'unresolved' ? unresolvedConflicts.length : resolvedConflicts.length})
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
              {filter === 'unresolved'
                ? 'No unresolved conflicts detected'
                : 'No conflicts match this filter'}
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
              onToggleExpand={() =>
                setExpandedConflict(expandedConflict === conflict.id ? null : conflict.id)
              }
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

        {/* Rule Comparison */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-surface-elevated rounded-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-blue-400">Rule A</p>
              <Badge variant="info">{conflict.ruleACode}</Badge>
            </div>
            <p className="text-xs text-text-muted">ID: {conflict.ruleAId}</p>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-purple-400">Rule B</p>
              <Badge variant="info">{conflict.ruleBCode}</Badge>
            </div>
            <p className="text-xs text-text-muted">ID: {conflict.ruleBId}</p>
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="p-3 bg-purple-500/10 rounded-lg mb-4 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm font-medium text-purple-400">AI Recommendation</p>
          </div>
          <p className="text-sm text-text-secondary">{conflict.aiResolutionRecommendation}</p>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mb-4 p-3 bg-surface rounded-lg border border-border">
            <p className="text-xs text-text-muted mb-2">Conflict Details</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Resolved: </span>
                <span>{conflict.resolvedAt ? new Date(conflict.resolvedAt).toLocaleString() : 'Not yet'}</span>
              </div>
              <div>
                <span className="text-text-muted">Resolved By: </span>
                <span>{conflict.resolvedBy || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isResolved && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onResolve(conflict.id, 'override')}>
              Manual Override
            </Button>
            <Button onClick={() => onResolve(conflict.id, 'accept')}>
              Accept Recommendation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
