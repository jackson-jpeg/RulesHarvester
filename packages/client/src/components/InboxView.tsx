import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { ViewErrorBoundary } from './ui/ViewErrorBoundary';
import { useUIStore } from '../store/uiStore';
import { InboxItemType, InboxStatus } from '@rulesharvester/shared';
import type { InboxItem, InboxStats } from '@rulesharvester/shared';

type TabFilter = 'all' | InboxItemType;

const TAB_FILTERS: { id: TabFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: InboxItemType.JURISDICTION_APPROVAL, label: 'Jurisdictions' },
  { id: InboxItemType.RULE_VERIFICATION, label: 'Rules' },
  { id: InboxItemType.WATCHTOWER_CHANGE, label: 'Changes' },
  { id: InboxItemType.SCRAPER_FAILURE, label: 'Failures' },
];

const TYPE_CONFIG: Record<
  InboxItemType,
  { icon: string; color: string; bgColor: string }
> = {
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

function InboxViewContent() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<TabFilter>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { setInboxCount } = useUIStore();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        status: InboxStatus.PENDING,
      });

      if (activeFilter !== 'all') {
        params.set('type', activeFilter);
      }

      const response = await api.get<{
        items: InboxItem[];
        total: number;
        totalPages: number;
      }>(`/inbox?${params.toString()}`);

      setItems(response.items || []);
      setTotalPages(response.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch inbox items:', error);
    } finally {
      setLoading(false);
    }
  }, [page, activeFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get<InboxStats>('/inbox/stats');
      setStats(response);
      setInboxCount(response.pending || 0);
    } catch (error) {
      console.error('Failed to fetch inbox stats:', error);
    }
  }, [setInboxCount]);

  useEffect(() => {
    fetchItems();
    fetchStats();
  }, [fetchItems, fetchStats]);

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/inbox/${id}/approve`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelectedItems((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
      fetchStats();
    } catch (error) {
      console.error('Failed to approve item:', error);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      await api.post(`/inbox/${id}/reject`, { reason });
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelectedItems((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
      fetchStats();
    } catch (error) {
      console.error('Failed to reject item:', error);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.size === 0) return;

    try {
      await api.post('/inbox/bulk-approve', { ids: Array.from(selectedItems) });
      setItems((prev) =>
        prev.filter((item) => !selectedItems.has(item.id))
      );
      setSelectedItems(new Set());
      setSelectedItem(null);
      fetchStats();
    } catch (error) {
      console.error('Failed to bulk approve items:', error);
    }
  };

  const handleBulkReject = async () => {
    if (selectedItems.size === 0) return;

    try {
      await api.post('/inbox/bulk-reject', { ids: Array.from(selectedItems) });
      setItems((prev) =>
        prev.filter((item) => !selectedItems.has(item.id))
      );
      setSelectedItems(new Set());
      setSelectedItem(null);
      fetchStats();
    } catch (error) {
      console.error('Failed to bulk reject items:', error);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) => {
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
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((item) => item.id)));
    }
  };

  const getTypeLabel = (type: InboxItemType): string => {
    switch (type) {
      case InboxItemType.JURISDICTION_APPROVAL:
        return 'Jurisdiction';
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

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined) return null;

    const variant =
      confidence >= 90 ? 'success' : confidence >= 50 ? 'warning' : 'error';

    return (
      <Badge variant={variant}>
        {confidence.toFixed(0)}%
      </Badge>
    );
  };

  return (
    <div className="flex h-full">
      {/* Main list area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Inbox</h1>
              <p className="text-text-secondary mt-1">
                Review and approve items requiring your attention
              </p>
            </div>
            {stats && (
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400">
                    {stats.pending}
                  </p>
                  <p className="text-xs text-text-muted">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    {stats.reviewed}
                  </p>
                  <p className="text-xs text-text-muted">Reviewed</p>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div
            className="flex gap-1 border-b border-border"
            role="tablist"
            aria-label="Filter inbox items"
          >
            {TAB_FILTERS.map((tab) => {
              const count =
                tab.id === 'all'
                  ? stats?.pending || 0
                  : stats?.byType[tab.id as InboxItemType] || 0;

              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeFilter === tab.id}
                  onClick={() => {
                    setActiveFilter(tab.id);
                    setPage(1);
                    setSelectedItems(new Set());
                  }}
                  className={`
                    px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
                    ${
                      activeFilter === tab.id
                        ? 'bg-surface-elevated text-amber-400 border-b-2 border-amber-400'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                    }
                  `}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bulk actions */}
          {selectedItems.size > 0 && (
            <div className="mt-4 flex items-center gap-4">
              <span className="text-sm text-text-secondary">
                {selectedItems.size} selected
              </span>
              <Button variant="primary" size="sm" onClick={handleBulkApprove}>
                Approve Selected
              </Button>
              <Button variant="danger" size="sm" onClick={handleBulkReject}>
                Reject Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedItems(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          )}
        </div>

        {/* List */}
        <div
          className="flex-1 overflow-y-auto p-4"
          role="tabpanel"
          aria-label="Inbox items"
        >
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-text-primary">
                Inbox is empty
              </h3>
              <p className="mt-1 text-text-secondary">
                No items require your attention right now.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select all */}
              <div className="flex items-center gap-2 px-4 py-2">
                <input
                  type="checkbox"
                  checked={
                    selectedItems.size === items.length && items.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="rounded border-border bg-surface-elevated text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-text-secondary">Select all</span>
              </div>

              {items.map((item) => {
                const config = TYPE_CONFIG[item.type];
                const isSelected = selectedItems.has(item.id);

                return (
                  <Card
                    key={item.id}
                    className={`
                      p-4 cursor-pointer transition-all
                      ${isSelected ? 'ring-2 ring-amber-500' : ''}
                      ${selectedItem?.id === item.id ? 'bg-surface-elevated' : ''}
                    `}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectItem(item.id);
                        }}
                        className="mt-1 rounded border-border bg-surface-elevated text-amber-500 focus:ring-amber-500"
                      />

                      {/* Type icon */}
                      <div
                        className={`p-2 rounded-lg ${config.bgColor}`}
                      >
                        <svg
                          className={`w-5 h-5 ${config.color}`}
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

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-text-primary truncate">
                            {item.title}
                          </h3>
                          <Badge variant="default">
                            {getTypeLabel(item.type)}
                          </Badge>
                          {getConfidenceBadge(item.confidence)}
                        </div>
                        {item.description && (
                          <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-text-muted">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(item.id);
                          }}
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          Approve
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
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-text-secondary">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <div className="w-96 border-l border-border bg-surface overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Details
              </h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded hover:bg-surface-elevated text-text-secondary"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Type badge */}
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
                <span
                  className={`text-sm font-medium ${
                    TYPE_CONFIG[selectedItem.type].color
                  }`}
                >
                  {getTypeLabel(selectedItem.type)}
                </span>
              </div>

              {/* Title */}
              <div>
                <h3 className="text-xl font-bold text-text-primary">
                  {selectedItem.title}
                </h3>
                {selectedItem.description && (
                  <p className="mt-2 text-text-secondary">
                    {selectedItem.description}
                  </p>
                )}
              </div>

              {/* Confidence */}
              {selectedItem.confidence !== undefined && (
                <div>
                  <p className="text-sm text-text-muted mb-1">Confidence</p>
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
                    <span className="text-sm font-medium text-text-primary">
                      {selectedItem.confidence.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Source URL */}
              {selectedItem.sourceUrl && (
                <div>
                  <p className="text-sm text-text-muted mb-1">Source</p>
                  <a
                    href={selectedItem.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 text-sm break-all"
                  >
                    {selectedItem.sourceUrl}
                  </a>
                </div>
              )}

              {/* Metadata */}
              {selectedItem.metadata &&
                Object.keys(selectedItem.metadata).length > 0 && (
                  <div>
                    <p className="text-sm text-text-muted mb-2">
                      Additional Info
                    </p>
                    <div className="bg-surface-elevated rounded-lg p-3 space-y-2">
                      {Object.entries(selectedItem.metadata).map(
                        ([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-sm text-text-secondary capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span className="text-sm text-text-primary">
                              {typeof value === 'object'
                                ? JSON.stringify(value)
                                : String(value)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* Timestamp */}
              <div>
                <p className="text-sm text-text-muted mb-1">Created</p>
                <p className="text-sm text-text-primary">
                  {new Date(selectedItem.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Actions */}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function InboxView() {
  return (
    <ViewErrorBoundary viewName="Inbox">
      <InboxViewContent />
    </ViewErrorBoundary>
  );
}
