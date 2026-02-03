import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input, Textarea } from './ui/Input';
import { Select } from './ui/Select';
import { Spinner, Skeleton } from './ui/Spinner';
import { ProgressBar } from './ui/ProgressBar';
import { ViewErrorBoundary } from './ui/ViewErrorBoundary';
import { toast } from './ui/Toast';
import { useUIStore, type CollectSubTab } from '../store/uiStore';
import { useJurisdictionsStore } from '../store/jurisdictionsStore';
import { useJobsStore } from '../store/jobsStore';
import { api } from '../api/client';
import {
  JurisdictionType,
  JurisdictionStatus,
  JobStatus,
  JOB_STATUS_CONFIG,
  LogType,
} from '@rulesharvester/shared';
import type { JurisdictionMeta, DiscoveryCandidate } from '@rulesharvester/shared';

// === TYPES ===
type CrawlMode = 'auto' | 'url' | 'manual';
type StatusFilter = 'all' | 'active' | 'completed' | 'failed';
type SortBy = 'newest' | 'oldest' | 'progress';

interface CrawlProgress {
  jurisdictionId: string;
  status: 'crawling' | 'completed' | 'error';
  pagesScraped?: number;
  candidatesFound?: number;
  error?: string;
}

interface CrawlResult {
  baseUrl: string;
  pagesScraped: number;
  errors: number;
  candidatesFound: number;
  duration: number;
  errorDetails?: string[];
}

interface CartographerStatus {
  isRunning: boolean;
  lastRunAt?: string;
  totalDiscovered: number;
  pendingApproval: number;
  approvedToday: number;
}

interface DiscoveryCandidateItem {
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

interface QueueResponse {
  items: DiscoveryCandidateItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// === SUB-TAB COMPONENTS ===

// --- JURISDICTIONS TAB (from JurisdictionDiscoveryView) ---
function JurisdictionsTab() {
  const [status, setStatus] = useState<CartographerStatus | null>(null);
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      toast.success('Discovery started');

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
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
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
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to bulk approve');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-rose-400 mb-4">{error}</p>
          <Button onClick={fetchData}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-purple-400">{status?.pendingApproval || 0}</p>
            <p className="text-sm text-text-secondary">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-emerald-400">{status?.approvedToday || 0}</p>
            <p className="text-sm text-text-secondary">Approved Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">{status?.totalDiscovered || 0}</p>
            <p className="text-sm text-text-secondary">Total Discovered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">
              {status?.isRunning ? <Spinner size="sm" /> : status?.lastRunAt ? new Date(status.lastRunAt).toLocaleDateString() : 'Never'}
            </p>
            <p className="text-sm text-text-secondary">{status?.isRunning ? 'Running' : 'Last Run'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="primary"
          onClick={handleDiscover}
          disabled={isDiscovering || status?.isRunning}
          isLoading={isDiscovering || status?.isRunning}
        >
          {isDiscovering || status?.isRunning ? 'Discovering...' : 'Discover New Courts'}
        </Button>
        {selectedIds.size > 0 && (
          <Button variant="secondary" onClick={handleBulkApprove}>
            Approve Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Queue */}
      <Card>
        <CardHeader>Discovery Queue ({queue?.total || 0})</CardHeader>
        <CardContent>
          {queue?.items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-muted">No jurisdictions pending approval.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue?.items.map((candidate) => (
                <div key={candidate.id} className="border border-border rounded-lg overflow-hidden">
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
                        onClick={() => setExpandedId(expandedId === candidate.id ? null : candidate.id)}
                      >
                        {expandedId === candidate.id ? 'Hide' : 'Details'}
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => handleApprove(candidate.id)}>
                        Approve
                      </Button>
                    </div>
                  </div>
                  {expandedId === candidate.id && (
                    <div className="p-4 bg-surface border-t border-border space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-text-muted mb-1">Discovery Source</p>
                          <p>{candidate.discoverySource}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted mb-1">Discovered At</p>
                          <p>{new Date(candidate.discoveredAt).toLocaleString()}</p>
                        </div>
                      </div>
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
        </CardContent>
      </Card>
    </div>
  );
}

// --- RULES TAB (from CrawlerView) ---
function RulesTab() {
  const { jurisdictions, groupedJurisdictions } = useJurisdictionsStore();
  const { createJob } = useJobsStore();
  const { addLog } = useUIStore();

  const [crawlMode, setCrawlMode] = useState<CrawlMode>('auto');
  const [crawlProgress, setCrawlProgress] = useState<Map<string, CrawlProgress>>(new Map());
  const [crawlUrl, setCrawlUrl] = useState('');
  const [selectedJurisdictionForUrl, setSelectedJurisdictionForUrl] = useState('');
  const [maxPages, setMaxPages] = useState(20);
  const [isUrlCrawling, setIsUrlCrawling] = useState(false);
  const [urlCrawlResult, setUrlCrawlResult] = useState<CrawlResult | null>(null);
  const [manualJurisdiction, setManualJurisdiction] = useState('');
  const [manualText, setManualText] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [discoveredCandidates, setDiscoveredCandidates] = useState<DiscoveryCandidate[]>([]);

  const crawlableJurisdictions = useMemo(() => {
    return jurisdictions.filter((j) => j.courtWebsite || j.scraperConfig?.baseUrl);
  }, [jurisdictions]);

  const handleAutoCrawl = async (jurisdiction: JurisdictionMeta) => {
    const crawlUrl = jurisdiction.scraperConfig?.baseUrl || jurisdiction.courtWebsite;
    if (!crawlUrl) {
      toast.error('No court website configured');
      return;
    }

    setCrawlProgress((prev) =>
      new Map(prev).set(jurisdiction.id, { jurisdictionId: jurisdiction.id, status: 'crawling' })
    );

    try {
      addLog(`Starting auto-crawl for ${jurisdiction.name}`, LogType.INFO);
      const result = await api.post<CrawlResult>('/discover/crawl', {
        baseUrl: crawlUrl,
        jurisdictionId: jurisdiction.id,
        maxPages: 30,
      });

      setCrawlProgress((prev) =>
        new Map(prev).set(jurisdiction.id, {
          jurisdictionId: jurisdiction.id,
          status: 'completed',
          pagesScraped: result.pagesScraped,
          candidatesFound: result.candidatesFound,
        })
      );

      addLog(`Found ${result.candidatesFound} rule candidates for ${jurisdiction.name}`, LogType.SUCCESS);
      toast.success(`Found ${result.candidatesFound} rule candidates`);

      if (result.candidatesFound > 0) {
        const candidates = await api.get<DiscoveryCandidate[]>(`/discover/${jurisdiction.id}`);
        setDiscoveredCandidates((prev) => [...prev, ...candidates.filter((c) => c.status === 'DISCOVERED')]);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Crawl failed';
      setCrawlProgress((prev) =>
        new Map(prev).set(jurisdiction.id, {
          jurisdictionId: jurisdiction.id,
          status: 'error',
          error: errorMsg,
        })
      );
      addLog(`Failed to crawl ${jurisdiction.name}: ${errorMsg}`, LogType.ERROR);
      toast.error('Crawl failed');
    }
  };

  const handleUrlCrawl = async () => {
    if (!crawlUrl) {
      toast.error('Please enter a URL to crawl');
      return;
    }

    setIsUrlCrawling(true);
    setUrlCrawlResult(null);

    try {
      addLog(`Starting URL crawl: ${crawlUrl}`, LogType.INFO);
      const result = await api.post<CrawlResult>('/discover/crawl', {
        baseUrl: crawlUrl,
        jurisdictionId: selectedJurisdictionForUrl || undefined,
        maxPages,
      });

      setUrlCrawlResult(result);
      addLog(`Found ${result.candidatesFound} rule candidates`, LogType.SUCCESS);
      toast.success(`Found ${result.candidatesFound} rule candidates`);

      if (selectedJurisdictionForUrl && result.candidatesFound > 0) {
        const candidates = await api.get<DiscoveryCandidate[]>(`/discover/${selectedJurisdictionForUrl}`);
        setDiscoveredCandidates((prev) => [...prev, ...candidates.filter((c) => c.status === 'DISCOVERED')]);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Crawl failed';
      addLog(`URL crawl failed: ${errorMsg}`, LogType.ERROR);
      toast.error(errorMsg);
    } finally {
      setIsUrlCrawling(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualJurisdiction) {
      toast.error('Please select a jurisdiction');
      return;
    }
    if (!manualText.trim()) {
      toast.error('Please enter the rule text');
      return;
    }

    setIsManualSubmitting(true);
    try {
      await createJob(manualJurisdiction, 'manual-entry', manualText);
      addLog('Extraction job created from manual entry', LogType.SUCCESS);
      toast.success('Extraction job created');
      setManualText('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create job';
      addLog(`Manual entry failed: ${msg}`, LogType.ERROR);
      toast.error(msg);
    } finally {
      setIsManualSubmitting(false);
    }
  };

  const handleAcquireCandidate = async (candidate: DiscoveryCandidate) => {
    try {
      await api.post(`/discover/${candidate.id}/acquire`);
      setDiscoveredCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
      addLog(`Started extraction for ${candidate.ruleId}`, LogType.SUCCESS);
      toast.success('Extraction started');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to acquire';
      toast.error(msg);
    }
  };

  const handleAcquireAll = async () => {
    if (discoveredCandidates.length === 0) return;
    try {
      const result = await api.post<{ queued: number }>('/discover/batch/acquire', {
        candidateIds: discoveredCandidates.map((c) => c.id),
      });
      setDiscoveredCandidates([]);
      addLog(`Started extraction for ${result.queued} rules`, LogType.SUCCESS);
      toast.success(`${result.queued} extractions started`);
    } catch (error) {
      toast.error('Failed to acquire');
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Tabs */}
      <div className="flex gap-2" role="tablist">
        {(['auto', 'url', 'manual'] as CrawlMode[]).map((mode) => (
          <button
            key={mode}
            role="tab"
            aria-selected={crawlMode === mode}
            onClick={() => setCrawlMode(mode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              crawlMode === mode
                ? 'bg-amber-500 text-black'
                : 'bg-surface-elevated text-text-secondary hover:bg-border'
            }`}
          >
            {mode === 'auto' ? 'Auto-Crawl' : mode === 'url' ? 'URL Discovery' : 'Manual Entry'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-8">
          {/* Auto-Crawl */}
          {crawlMode === 'auto' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span>Crawlable Jurisdictions</span>
                  <Badge variant="info">{crawlableJurisdictions.length} configured</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {crawlableJurisdictions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-text-secondary">No jurisdictions have court websites configured</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedJurisdictions?.federalCircuits.filter((j) => j.courtWebsite || j.scraperConfig?.baseUrl).length ? (
                      <div>
                        <h4 className="text-sm font-medium text-text-secondary mb-2">Federal Circuits</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {groupedJurisdictions.federalCircuits
                            .filter((j) => j.courtWebsite || j.scraperConfig?.baseUrl)
                            .map((j) => (
                              <JurisdictionCrawlCard
                                key={j.id}
                                jurisdiction={j}
                                progress={crawlProgress.get(j.id)}
                                onCrawl={() => handleAutoCrawl(j)}
                              />
                            ))}
                        </div>
                      </div>
                    ) : null}
                    {groupedJurisdictions?.states.filter((j) => j.courtWebsite || j.scraperConfig?.baseUrl).length ? (
                      <div>
                        <h4 className="text-sm font-medium text-text-secondary mb-2">State Courts</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {groupedJurisdictions.states
                            .filter((j) => j.courtWebsite || j.scraperConfig?.baseUrl)
                            .map((j) => (
                              <JurisdictionCrawlCard
                                key={j.id}
                                jurisdiction={j}
                                progress={crawlProgress.get(j.id)}
                                onCrawl={() => handleAutoCrawl(j)}
                              />
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* URL Discovery */}
          {crawlMode === 'url' && (
            <Card>
              <CardHeader>URL Discovery</CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    label="Court Website URL"
                    type="url"
                    placeholder="https://www.courts.gov/rules/..."
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    helperText="Enter the URL of a court rules page to crawl"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Associate with Jurisdiction</label>
                      <select
                        value={selectedJurisdictionForUrl}
                        onChange={(e) => setSelectedJurisdictionForUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">None (just explore)</option>
                        {jurisdictions.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.name} ({j.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Max Pages</label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={maxPages}
                        onChange={(e) => setMaxPages(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <Button onClick={handleUrlCrawl} isLoading={isUrlCrawling} disabled={!crawlUrl} className="w-full">
                    Start Crawling
                  </Button>
                  {urlCrawlResult && (
                    <div className="p-4 bg-surface-elevated rounded-lg">
                      <h4 className="font-medium mb-2">Crawl Results</h4>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-text-muted">Pages</p>
                          <p className="text-lg font-semibold text-amber-400">{urlCrawlResult.pagesScraped}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Found</p>
                          <p className="text-lg font-semibold text-emerald-400">{urlCrawlResult.candidatesFound}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Errors</p>
                          <p className="text-lg font-semibold text-rose-400">{urlCrawlResult.errors}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Duration</p>
                          <p className="text-lg font-semibold">{(urlCrawlResult.duration / 1000).toFixed(1)}s</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Entry */}
          {crawlMode === 'manual' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span>Manual Text Entry</span>
                  <Badge variant="warning">Fallback Only</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-text-muted mb-4">
                  Use this only when automated crawling doesn't work.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Jurisdiction</label>
                    <select
                      value={manualJurisdiction}
                      onChange={(e) => setManualJurisdiction(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Select a jurisdiction...</option>
                      {jurisdictions.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name} ({j.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <Textarea
                    label="Rule Text"
                    placeholder="Paste the complete rule text here..."
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <Button
                    onClick={handleManualSubmit}
                    isLoading={isManualSubmitting}
                    disabled={!manualJurisdiction || !manualText.trim()}
                    className="w-full"
                  >
                    Extract Rule
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Discovered Candidates Sidebar */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="sticky top-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <span>Discovered Rules</span>
                {discoveredCandidates.length > 0 && (
                  <Button size="sm" onClick={handleAcquireAll}>
                    Extract All ({discoveredCandidates.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {discoveredCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-text-muted text-sm">No pending discoveries</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {discoveredCandidates.map((candidate) => (
                    <div key={candidate.id} className="p-3 bg-surface-elevated rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{candidate.ruleId}</p>
                          <p className="text-xs text-text-muted truncate">{candidate.jurisdiction}</p>
                        </div>
                        <Badge
                          variant={
                            candidate.relevanceScore >= 80
                              ? 'success'
                              : candidate.relevanceScore >= 50
                              ? 'warning'
                              : 'error'
                          }
                        >
                          {candidate.relevanceScore}%
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" className="flex-1" onClick={() => handleAcquireCandidate(candidate)}>
                          Extract
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function JurisdictionCrawlCard({
  jurisdiction,
  progress,
  onCrawl,
}: {
  jurisdiction: JurisdictionMeta;
  progress?: CrawlProgress;
  onCrawl: () => void;
}) {
  const isCrawling = progress?.status === 'crawling';
  const isCompleted = progress?.status === 'completed';
  const hasError = progress?.status === 'error';

  return (
    <button
      onClick={onCrawl}
      disabled={isCrawling}
      className={`p-3 rounded-lg text-left transition-all ${
        isCrawling
          ? 'bg-amber-500/20 border border-amber-500/50'
          : isCompleted
          ? 'bg-emerald-500/20 border border-emerald-500/50'
          : hasError
          ? 'bg-rose-500/20 border border-rose-500/50'
          : jurisdiction.status === JurisdictionStatus.SYNCED
          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-transparent'
          : 'bg-surface-elevated hover:bg-border border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{jurisdiction.code.replace(/^(FED-|DIST-|ST-)/, '')}</span>
        {isCrawling && <Spinner size="sm" />}
        {isCompleted && <Badge variant="success" className="text-xs">{progress.candidatesFound}</Badge>}
        {hasError && <Badge variant="error" className="text-xs">!</Badge>}
      </div>
      <p className="text-xs text-text-muted truncate">
        {isCrawling
          ? `Crawling... (${progress.pagesScraped || 0} pages)`
          : isCompleted
          ? `${progress.candidatesFound} rules found`
          : hasError
          ? progress.error?.slice(0, 30)
          : 'Click to crawl'}
      </p>
    </button>
  );
}

// --- JOBS TAB (from WorkflowView) ---
function JobsTab() {
  const { jobs, isLoading, fetchJobs, cancelJob, retryJob } = useJobsStore();
  const { sseConnectionStatus, setActiveJobCount } = useUIStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const activeCount = jobs.filter((j) => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING).length;
    setActiveJobCount(activeCount);
  }, [jobs, setActiveJobCount]);

  const activeJobs = jobs.filter((j) => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING);
  const completedJobs = jobs.filter((j) => j.status === JobStatus.COMPLETED);
  const failedJobs = jobs.filter((j) => j.status === JobStatus.FAILED);

  const filteredJobs = useCallback(() => {
    let filtered = [...jobs];
    switch (statusFilter) {
      case 'active':
        filtered = filtered.filter((j) => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING);
        break;
      case 'completed':
        filtered = filtered.filter((j) => j.status === JobStatus.COMPLETED);
        break;
      case 'failed':
        filtered = filtered.filter((j) => j.status === JobStatus.FAILED);
        break;
    }
    switch (sortBy) {
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'progress':
        filtered.sort((a, b) => b.progress - a.progress);
        break;
    }
    return filtered;
  }, [jobs, statusFilter, sortBy]);

  const displayedJobs = filteredJobs();

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">{activeJobs.length}</p>
            <p className="text-sm text-text-secondary">Active Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-emerald-400">{completedJobs.length}</p>
            <p className="text-sm text-text-secondary">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-rose-400">{failedJobs.length}</p>
            <p className="text-sm text-text-secondary">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span>Active Extractions</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <JobCard key={job.id} job={job} onCancel={() => cancelJob(job.id)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card padding="sm">
        <CardContent className="flex items-center gap-4">
          <div className="w-40">
            <Select
              value={statusFilter}
              options={[
                { value: 'all', label: 'All Jobs' },
                { value: 'active', label: 'Active' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
              ]}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            />
          </div>
          <div className="w-40">
            <Select
              value={sortBy}
              options={[
                { value: 'newest', label: 'Newest First' },
                { value: 'oldest', label: 'Oldest First' },
                { value: 'progress', label: 'By Progress' },
              ]}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            />
          </div>
          <span className="text-sm text-text-muted">Showing {displayedJobs.length} of {jobs.length} jobs</span>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                sseConnectionStatus === 'connected'
                  ? 'bg-emerald-400'
                  : sseConnectionStatus === 'reconnecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-400'
              }`}
            />
            <span className="text-sm text-text-secondary">
              {sseConnectionStatus === 'connected' ? 'Live' : sseConnectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader>Job History</CardHeader>
        <CardContent>
          {displayedJobs.length === 0 ? (
            <p className="text-center text-text-muted py-8">
              {jobs.length === 0 ? 'No jobs yet' : 'No matching jobs'}
            </p>
          ) : (
            <div className="space-y-2">
              {displayedJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        job.status === JobStatus.COMPLETED
                          ? 'success'
                          : job.status === JobStatus.FAILED
                          ? 'error'
                          : job.status === JobStatus.PROCESSING
                          ? 'warning'
                          : 'info'
                      }
                    >
                      {job.jurisdictionCode}
                    </Badge>
                    <div>
                      <p className="font-medium">{job.currentStep || 'Pending'}</p>
                      <p className="text-xs text-text-muted">{new Date(job.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {job.status === JobStatus.PROCESSING && (
                      <div className="w-32">
                        <ProgressBar value={job.progress} size="sm" />
                      </div>
                    )}
                    <Badge
                      variant={
                        job.status === JobStatus.COMPLETED
                          ? 'success'
                          : job.status === JobStatus.FAILED
                          ? 'error'
                          : job.status === JobStatus.PROCESSING
                          ? 'warning'
                          : 'default'
                      }
                    >
                      {JOB_STATUS_CONFIG[job.status]?.label || job.status}
                    </Badge>
                    {job.status === JobStatus.FAILED && (
                      <Button variant="ghost" size="sm" onClick={() => retryJob(job.id)}>
                        Retry
                      </Button>
                    )}
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

const EXTRACTION_STEPS = [
  { key: 'fetching', label: 'Fetch', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
  { key: 'parsing', label: 'Parse', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'extracting', label: 'Extract', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { key: 'analyzing', label: 'Analyze', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { key: 'saving', label: 'Save', icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4' },
];

function getStepIndex(currentStep?: string): number {
  if (!currentStep) return 0;
  const step = currentStep.toLowerCase();
  if (step.includes('fetch') || step.includes('download')) return 0;
  if (step.includes('pars')) return 1;
  if (step.includes('extract')) return 2;
  if (step.includes('analy') || step.includes('ai') || step.includes('process')) return 3;
  if (step.includes('sav') || step.includes('stor') || step.includes('complet')) return 4;
  return Math.floor((EXTRACTION_STEPS.length - 1) * (parseInt(currentStep) || 0) / 100);
}

interface JobCardProps {
  job: {
    id: string;
    jurisdictionCode: string;
    status: string;
    progress: number;
    currentStep?: string;
    agentConsensus?: number;
    createdAt?: Date | string;
  };
  onCancel: () => void;
}

function JobCard({ job, onCancel }: JobCardProps) {
  const currentStepIdx = getStepIndex(job.currentStep);

  return (
    <div className="p-4 border border-border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <div>
            <p className="font-semibold">{job.jurisdictionCode}</p>
            <p className="text-sm text-text-muted">{job.currentStep || 'Starting...'}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="flex items-center justify-between mb-4">
        {EXTRACTION_STEPS.map((step, idx) => {
          const isComplete = idx < currentStepIdx;
          const isCurrent = idx === currentStepIdx;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isComplete ? 'bg-emerald-500' : isCurrent ? 'bg-amber-500 animate-pulse' : 'bg-surface-elevated'
                  }`}
                >
                  <svg
                    className={`w-4 h-4 ${isComplete ? 'text-white' : isCurrent ? 'text-black' : 'text-text-muted'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
                  </svg>
                </div>
                <span className={`text-xs mt-1 ${isCurrent ? 'text-amber-400' : 'text-text-muted'}`}>{step.label}</span>
              </div>
              {idx < EXTRACTION_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isComplete ? 'bg-emerald-500' : 'bg-surface-elevated'}`} />
              )}
            </div>
          );
        })}
      </div>

      <ProgressBar value={job.progress} showLabel />

      {job.agentConsensus !== undefined && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-text-muted">Agent Consensus:</span>
          <Badge variant={job.agentConsensus >= 80 ? 'success' : job.agentConsensus >= 60 ? 'warning' : 'error'}>
            {job.agentConsensus}%
          </Badge>
        </div>
      )}
    </div>
  );
}

// === MAIN COMPONENT ===
function CollectViewContent() {
  const { activeSubTab, setActiveSubTab } = useUIStore();
  const currentTab = (activeSubTab as CollectSubTab) || 'jurisdictions';

  const tabs: { id: CollectSubTab; label: string }[] = [
    { id: 'jurisdictions', label: 'Jurisdictions' },
    { id: 'rules', label: 'Rules' },
    { id: 'jobs', label: 'Jobs' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Collect</h1>
        <p className="text-text-secondary">Discover jurisdictions, extract rules, and track jobs</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={currentTab === tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              currentTab === tab.id
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {currentTab === 'jurisdictions' && <JurisdictionsTab />}
      {currentTab === 'rules' && <RulesTab />}
      {currentTab === 'jobs' && <JobsTab />}
    </div>
  );
}

export function CollectView() {
  return (
    <ViewErrorBoundary viewName="Collect">
      <CollectViewContent />
    </ViewErrorBoundary>
  );
}
