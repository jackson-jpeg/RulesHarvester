import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Skeleton } from './ui/Spinner';
import { ViewErrorBoundary } from './ui/ViewErrorBoundary';
import { DiffViewer } from './ui/DiffViewer';
import { useUIStore } from '../store/uiStore';
import { useJobsStore } from '../store/jobsStore';
import { useRulesStore } from '../store/rulesStore';
import { api } from '../api/client';
import { JobStatus, LogType, InboxItemType, InboxStatus } from '@rulesharvester/shared';
import type { SystemLog, InboxItem, InboxStats } from '@rulesharvester/shared';

type InboxFilter = 'all' | InboxItemType;

const INBOX_FILTERS: { id: InboxFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: InboxItemType.JURISDICTION_APPROVAL, label: 'Approvals' },
  { id: InboxItemType.WATCHTOWER_CHANGE, label: 'Changes' },
  { id: InboxItemType.SCRAPER_FAILURE, label: 'Failures' },
];

const TYPE_CONFIG: Record<InboxItemType, { icon: string; color: string; bgColor: string }> = {
  [InboxItemType.JURISDICTION_APPROVAL]: {
    icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  [InboxItemType.RULE_VERIFICATION]: {
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  [InboxItemType.WATCHTOWER_CHANGE]: {
    icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  [InboxItemType.SCRAPER_FAILURE]: {
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
  },
};

interface DashboardStats {
  totalRules: number;
  totalJurisdictions: number;
  syncedJurisdictions: number;
  pendingJobs: number;
  unresolvedConflicts: number;
  avgConfidenceScore: number;
}

interface SystemStatus {
  cartographer: { jurisdictionsWithConfig: number; totalJurisdictions: number; coverage: number };
  watchtower: { autoSyncEnabled: number; recentScans: number };
}

interface DBSystemLog {
  id: string;
  message: string;
  type: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function HomeViewContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [dbLogs, setDbLogs] = useState<SystemLog[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxStats, setInboxStats] = useState<InboxStats | null>(null);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');

  const { jobs } = useJobsStore();
  const { rules } = useRulesStore();
  const { systemLogs, setActiveTab, setInboxCount, addLog, setActiveJobCount } = useUIStore();

  // Merge DB logs with SSE logs
  const mergedLogs = useCallback(() => {
    const sseLogIds = new Set(systemLogs.map((l) => l.id));
    const uniqueDbLogs = dbLogs.filter((l) => !sseLogIds.has(l.id));
    return [...systemLogs, ...uniqueDbLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [systemLogs, dbLogs]);

  const fetchData = async () => {
    try {
      const [statsData, systemData, logsData, inboxData, inboxStatsData] = await Promise.all([
        api.get<DashboardStats>('/stats'),
        api.get<SystemStatus>('/stats/system'),
        api.get<DBSystemLog[]>('/stats/logs?limit=15'),
        api.get<{ items: InboxItem[] }>(`/inbox?status=${InboxStatus.PENDING}&pageSize=10`),
        api.get<InboxStats>('/inbox/stats'),
      ]);

      setStats(statsData);
      setSystemStatus(systemData);
      setDbLogs(
        logsData.map((l) => ({
          id: l.id,
          message: l.message,
          type: l.type as SystemLog['type'],
          timestamp: new Date(l.createdAt),
          metadata: l.metadata,
        }))
      );
      setInboxItems(inboxData.items || []);
      setInboxStats(inboxStatsData);
      setInboxCount(inboxStatsData.pending || 0);
    } catch (error) {
      console.error('Failed to fetch home data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update active job count when jobs change
  useEffect(() => {
    const activeCount = jobs.filter(
      (j) => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING
    ).length;
    setActiveJobCount(activeCount);
  }, [jobs, setActiveJobCount]);

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/inbox/${id}/approve`);
      setInboxItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
      setInboxCount((inboxStats?.pending || 1) - 1);
      addLog('Item approved', LogType.SUCCESS);
    } catch (error) {
      console.error('Failed to approve item:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/inbox/${id}/reject`, {});
      setInboxItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
      setInboxCount((inboxStats?.pending || 1) - 1);
      addLog('Item rejected', LogType.INFO);
    } catch (error) {
      console.error('Failed to reject item:', error);
    }
  };

  const handleBulkApproveHighConfidence = async () => {
    const highConfidenceIds = inboxItems
      .filter((item) => (item.confidence ?? 0) >= 90)
      .map((item) => item.id);

    if (highConfidenceIds.length === 0) return;

    try {
      await api.post('/inbox/bulk-approve', { ids: highConfidenceIds });
      setInboxItems((prev) => prev.filter((item) => !highConfidenceIds.includes(item.id)));
      setSelectedItem(null);
      fetchData();
      addLog(`Approved ${highConfidenceIds.length} high-confidence items`, LogType.SUCCESS);
    } catch (error) {
      console.error('Failed to bulk approve:', error);
    }
  };

  const filteredInboxItems =
    inboxFilter === 'all'
      ? inboxItems
      : inboxItems.filter((item) => item.type === inboxFilter);

  const highConfidenceCount = inboxItems.filter((item) => (item.confidence ?? 0) >= 90).length;

  const getTypeLabel = (type: InboxItemType): string => {
    switch (type) {
      case InboxItemType.JURISDICTION_APPROVAL:
        return 'Approval';
      case InboxItemType.RULE_VERIFICATION:
        return 'Rule';
      case InboxItemType.WATCHTOWER_CHANGE:
        return 'Change';
      case InboxItemType.SCRAPER_FAILURE:
        return 'Failure';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <Skeleton className="col-span-12 lg:col-span-7 h-96" />
          <Skeleton className="col-span-12 lg:col-span-5 h-96" />
        </div>
      </div>
    );
  }

  const activeJobs = jobs.filter(
    (j) => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Home</h1>
          <p className="text-text-secondary">What needs attention</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setActiveTab('collect')}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          New Extraction
        </Button>
      </div>

      {/* System Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setActiveTab('library')}
          className="text-left focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg"
        >
          <Card className="h-full hover:border-amber-500/50 transition-colors cursor-pointer">
            <CardContent>
              <p className="text-sm text-text-secondary">Total Rules</p>
              <p className="text-3xl font-bold text-amber-400">
                {stats?.totalRules || rules.length}
              </p>
              <p className="text-xs text-text-muted mt-1">Click to view</p>
            </CardContent>
          </Card>
        </button>

        <Card>
          <CardContent>
            <p className="text-sm text-text-secondary">Synced</p>
            <p className="text-3xl font-bold text-emerald-400">
              {stats?.syncedJurisdictions || 0}/{stats?.totalJurisdictions || 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Jurisdictions</p>
          </CardContent>
        </Card>

        <button
          onClick={() => setActiveTab('collect')}
          className="text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
        >
          <Card className="h-full hover:border-blue-500/50 transition-colors cursor-pointer">
            <CardContent>
              <p className="text-sm text-text-secondary">Active Jobs</p>
              <p className="text-3xl font-bold text-blue-400">{activeJobs.length}</p>
              <p className="text-xs text-text-muted mt-1">Click to view</p>
            </CardContent>
          </Card>
        </button>

        <Card>
          <CardContent>
            <p className="text-sm text-text-secondary">AI Coverage</p>
            <p className="text-3xl font-bold text-purple-400">
              {systemStatus?.cartographer.coverage || 0}%
            </p>
            <p className="text-xs text-text-muted mt-1">Jurisdictions configured</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Needs Attention Section */}
        <div className="col-span-12 lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>Needs Attention</span>
                  {(inboxStats?.pending || 0) > 0 && (
                    <Badge variant="warning">{inboxStats?.pending}</Badge>
                  )}
                </div>
                {highConfidenceCount > 0 && (
                  <Button variant="secondary" size="sm" onClick={handleBulkApproveHighConfidence}>
                    Approve High-Confidence ({highConfidenceCount})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter Tabs */}
              <div className="flex gap-1 mb-4 border-b border-border" role="tablist">
                {INBOX_FILTERS.map((filter) => {
                  const count =
                    filter.id === 'all'
                      ? inboxItems.length
                      : inboxItems.filter((i) => i.type === filter.id).length;

                  return (
                    <button
                      key={filter.id}
                      role="tab"
                      aria-selected={inboxFilter === filter.id}
                      onClick={() => setInboxFilter(filter.id)}
                      className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                        inboxFilter === filter.id
                          ? 'bg-surface-elevated text-amber-400 border-b-2 border-amber-400'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {filter.label}
                      {count > 0 && (
                        <span className="ml-1.5 text-xs opacity-70">({count})</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Items List */}
              {filteredInboxItems.length === 0 ? (
                <div className="text-center py-8">
                  <svg
                    className="mx-auto h-12 w-12 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-text-primary">All caught up!</h3>
                  <p className="text-text-secondary">No items require your attention.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredInboxItems.map((item) => {
                    const config = TYPE_CONFIG[item.type];
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedItem?.id === item.id
                            ? 'bg-amber-500/10 border border-amber-500/30'
                            : 'bg-surface-elevated hover:bg-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${config.bgColor}`}>
                            <svg
                              className={`w-4 h-4 ${config.color}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={config.icon}
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm truncate">{item.title}</h4>
                              <Badge variant="default" className="text-xs">
                                {getTypeLabel(item.type)}
                              </Badge>
                              {item.confidence !== undefined && (
                                <Badge
                                  variant={
                                    item.confidence >= 90
                                      ? 'success'
                                      : item.confidence >= 50
                                      ? 'warning'
                                      : 'error'
                                  }
                                  className="text-xs"
                                >
                                  {item.confidence}%
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-text-muted mt-1 line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(item.id);
                              }}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReject(item.id);
                              }}
                              className="text-rose-400 hover:text-rose-300"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Detail Panel or Activity */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Selected Item Detail */}
          {selectedItem && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span>Details</span>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-1 rounded hover:bg-surface-elevated text-text-secondary"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                    TYPE_CONFIG[selectedItem.type].bgColor
                  }`}
                >
                  <svg
                    className={`w-4 h-4 ${TYPE_CONFIG[selectedItem.type].color}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={TYPE_CONFIG[selectedItem.type].icon}
                    />
                  </svg>
                  <span className={`text-sm font-medium ${TYPE_CONFIG[selectedItem.type].color}`}>
                    {getTypeLabel(selectedItem.type)}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold">{selectedItem.title}</h3>
                  {selectedItem.description && (
                    <p className="mt-2 text-sm text-text-secondary">{selectedItem.description}</p>
                  )}
                </div>

                {selectedItem.confidence !== undefined && (
                  <div>
                    <p className="text-xs text-text-muted mb-1">Confidence</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            selectedItem.confidence >= 90
                              ? 'bg-emerald-500'
                              : selectedItem.confidence >= 50
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${selectedItem.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{selectedItem.confidence}%</span>
                    </div>
                  </div>
                )}

                {/* Diff Viewer for Watchtower Changes */}
                {selectedItem.type === InboxItemType.WATCHTOWER_CHANGE && selectedItem.metadata && (
                  <DiffViewer
                    oldText={selectedItem.metadata.previousRawText as string | undefined}
                    newText={selectedItem.metadata.newRawText as string | undefined}
                    added={(selectedItem.metadata.linesAdded as number) || 0}
                    removed={(selectedItem.metadata.linesRemoved as number) || 0}
                    diffSummary={
                      (selectedItem.metadata.diffSummary as string) ||
                      selectedItem.description ||
                      'Changes detected'
                    }
                  />
                )}

                <div className="pt-4 border-t border-border flex gap-3">
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => handleApprove(selectedItem.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => handleReject(selectedItem.id)}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card>
            <CardHeader>Recent Activity</CardHeader>
            <CardContent>
              {mergedLogs().length > 0 ? (
                <div className="space-y-1 max-h-[250px] overflow-y-auto font-mono text-xs">
                  {mergedLogs().map((log) => (
                    <div
                      key={log.id}
                      className={`py-1 ${
                        log.type === LogType.ERROR
                          ? 'text-rose-400'
                          : log.type === LogType.SUCCESS
                          ? 'text-emerald-400'
                          : log.type === LogType.WARN
                          ? 'text-amber-400'
                          : log.type === LogType.AI
                          ? 'text-purple-400'
                          : 'text-text-secondary'
                      }`}
                    >
                      [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-text-muted py-4">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function HomeView() {
  return (
    <ViewErrorBoundary viewName="Home">
      <HomeViewContent />
    </ViewErrorBoundary>
  );
}
