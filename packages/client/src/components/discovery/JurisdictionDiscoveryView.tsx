import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { toast } from '../ui/Toast';
import { api } from '../../api/client';
import {
  JurisdictionType,
  JURISDICTION_STATUS_CONFIG,
} from '@rulesharvester/shared';

interface DiscoveryCandidate {
  id: string;
  name: string;
  code: string;
  type: JurisdictionType;
  courtWebsite: string;
  discoveryScore: number;
  discoveryUrl: string;
  discoveryQuery: string;
  discoverySource: string;
  discoveredAt: string;
  hasRulesSection: boolean;
  rulesPageUrl?: string;
  reasoning: string;
}

interface CartographerStatus {
  isRunning: boolean;
  lastRunAt?: string;
  totalDiscovered: number;
  pendingApproval: number;
  approvedToday: number;
}

interface QueueResponse {
  items: DiscoveryCandidate[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function JurisdictionDiscoveryView() {
  const [status, setStatus] = useState<CartographerStatus | null>(null);
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [statusRes, queueRes] = await Promise.all([
        api.get<CartographerStatus>('/cartographer/status'),
        api.get<QueueResponse>('/cartographer/queue'),
      ]);

      setStatus(statusRes);
      setQueue(queueRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDiscover = async () => {
    try {
      setIsDiscovering(true);
      await api.post('/cartographer/discover', {});
      toast.success('Discovery started - this may take a few minutes');

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const newStatus = await api.get<CartographerStatus>('/cartographer/status');
          setStatus(newStatus);

          if (!newStatus.isRunning) {
            clearInterval(pollInterval);
            setIsDiscovering(false);
            fetchData();
            toast.success('Discovery complete!');
          }
        } catch {
          clearInterval(pollInterval);
          setIsDiscovering(false);
        }
      }, 5000);

      // Stop polling after 5 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsDiscovering(false);
      }, 300000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start discovery');
      setIsDiscovering(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/cartographer/approve/${id}`, {});
      toast.success('Jurisdiction approved');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason) return;

    try {
      await api.post(`/cartographer/reject/${rejectingId}`, {
        reason: rejectReason,
      });
      toast.success('Jurisdiction rejected');
      setRejectModalOpen(false);
      setRejectingId(null);
      setRejectReason('');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(rejectingId);
        return next;
      });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;

    try {
      const result = await api.post<{ approved: number; failed: number }>(
        '/cartographer/bulk-approve',
        { ids: Array.from(selectedIds) }
      );
      toast.success(`Approved ${result.approved} jurisdictions`);
      if (result.failed > 0) {
        toast.warning(`${result.failed} approvals failed`);
      }
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to bulk approve');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!queue) return;

    if (selectedIds.size === queue.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queue.items.map((c) => c.id)));
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 80) return <Badge variant="success">{score}%</Badge>;
    if (score >= 60) return <Badge variant="warning">{score}%</Badge>;
    return <Badge variant="error">{score}%</Badge>;
  };

  const getTypeBadge = (type: JurisdictionType) => {
    const labels: Record<JurisdictionType, string> = {
      FEDERAL_CIRCUIT: 'Circuit',
      FEDERAL_DISTRICT: 'District',
      STATE: 'State',
    };
    return <Badge variant="info">{labels[type]}</Badge>;
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
      <div className="space-y-6 animate-fadeIn">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-rose-400 mb-4">{error}</p>
            <Button onClick={fetchData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jurisdiction Discovery</h1>
          <p className="text-text-secondary">
            AI-powered discovery of court websites using Claude web search
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleDiscover}
            disabled={isDiscovering || status?.isRunning}
            isLoading={isDiscovering || status?.isRunning}
          >
            {isDiscovering || status?.isRunning ? 'Discovering...' : 'Discover New Courts'}
          </Button>
          <Button onClick={fetchData} variant="ghost">
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-purple-400">
              {status?.pendingApproval || 0}
            </p>
            <p className="text-sm text-text-secondary">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-emerald-400">
              {status?.approvedToday || 0}
            </p>
            <p className="text-sm text-text-secondary">Approved Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">
              {status?.totalDiscovered || 0}
            </p>
            <p className="text-sm text-text-secondary">Total Discovered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">
              {status?.isRunning ? (
                <Spinner size="sm" />
              ) : status?.lastRunAt ? (
                new Date(status.lastRunAt).toLocaleDateString()
              ) : (
                'Never'
              )}
            </p>
            <p className="text-sm text-text-secondary">
              {status?.isRunning ? 'Running' : 'Last Run'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm text-text-secondary">
              {selectedIds.size} jurisdiction{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
              <Button variant="primary" size="sm" onClick={handleBulkApprove}>
                Approve Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discovery Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>Discovery Queue ({queue?.total || 0})</span>
            {queue && queue.items.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === queue.items.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-border bg-surface"
                />
                Select All
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {queue?.items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted mb-4">
                No jurisdictions pending approval.
              </p>
              <Button variant="primary" onClick={handleDiscover} disabled={isDiscovering}>
                Discover New Courts
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {queue?.items.map((candidate) => (
                <div
                  key={candidate.id}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  {/* Main Row */}
                  <div className="flex items-center gap-4 p-4 bg-surface-elevated">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(candidate.id)}
                      onChange={() => toggleSelection(candidate.id)}
                      className="w-4 h-4 rounded border-border bg-surface"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{candidate.name}</span>
                        <Badge variant="default">{candidate.code}</Badge>
                        {getTypeBadge(candidate.type)}
                        {getConfidenceBadge(candidate.discoveryScore)}
                      </div>
                      <a
                        href={candidate.courtWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline truncate block max-w-lg"
                      >
                        {candidate.courtWebsite}
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedId(expandedId === candidate.id ? null : candidate.id)
                        }
                      >
                        {expandedId === candidate.id ? 'Hide Details' : 'Details'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setRejectingId(candidate.id);
                          setRejectModalOpen(true);
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(candidate.id)}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === candidate.id && (
                    <div className="p-4 bg-surface border-t border-border space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-text-muted mb-1">Discovery Source</p>
                          <p className="text-sm">{candidate.discoverySource}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted mb-1">Discovered At</p>
                          <p className="text-sm">
                            {new Date(candidate.discoveredAt).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted mb-1">Search Query</p>
                          <p className="text-sm truncate">{candidate.discoveryQuery}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted mb-1">Has Rules Section</p>
                          <Badge variant={candidate.hasRulesSection ? 'success' : 'warning'}>
                            {candidate.hasRulesSection ? 'Yes' : 'Unknown'}
                          </Badge>
                        </div>
                      </div>

                      {candidate.rulesPageUrl && (
                        <div>
                          <p className="text-xs text-text-muted mb-1">Rules Page URL</p>
                          <a
                            href={candidate.rulesPageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:underline"
                          >
                            {candidate.rulesPageUrl}
                          </a>
                        </div>
                      )}

                      {candidate.reasoning && (
                        <div>
                          <p className="text-xs text-text-muted mb-1">AI Reasoning</p>
                          <p className="text-sm text-text-secondary bg-surface-elevated p-3 rounded">
                            {candidate.reasoning}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {queue && queue.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <span className="text-sm text-text-muted">
                Page {queue.page} of {queue.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={queue.page <= 1}
                  onClick={() => {
                    // Handle pagination
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={queue.page >= queue.totalPages}
                  onClick={() => {
                    // Handle pagination
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>How Discovery Works</CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-surface-elevated rounded-lg">
              <div className="text-2xl mb-2">1</div>
              <p className="text-sm font-medium mb-1">Web Search</p>
              <p className="text-xs text-text-muted">
                Claude searches for official court websites using targeted queries
              </p>
            </div>
            <div className="p-4 bg-surface-elevated rounded-lg">
              <div className="text-2xl mb-2">2</div>
              <p className="text-sm font-medium mb-1">Domain Filter</p>
              <p className="text-xs text-text-muted">
                Filters out legal aggregators, keeps only .gov/.us domains
              </p>
            </div>
            <div className="p-4 bg-surface-elevated rounded-lg">
              <div className="text-2xl mb-2">3</div>
              <p className="text-sm font-medium mb-1">AI Analysis</p>
              <p className="text-xs text-text-muted">
                Claude analyzes each site to identify rules sections
              </p>
            </div>
            <div className="p-4 bg-surface-elevated rounded-lg">
              <div className="text-2xl mb-2">4</div>
              <p className="text-sm font-medium mb-1">Approval Queue</p>
              <p className="text-xs text-text-muted">
                Review and approve discovered jurisdictions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn"
          onClick={() => {
            setRejectModalOpen(false);
            setRejectingId(null);
            setRejectReason('');
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
        >
          <Card
            className="max-w-md w-full mx-4 shadow-xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 id="reject-modal-title" className="text-lg font-semibold text-text-primary">
                    Reject Jurisdiction
                  </h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    Please provide a reason for rejecting this jurisdiction.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm text-text-secondary mb-2">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., Not an official court website, duplicate, etc."
                  className="w-full p-3 bg-surface border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                  rows={3}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectingId(null);
                    setRejectReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
