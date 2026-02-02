import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useJobsStore } from '../../store/jobsStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';
import { toast } from '../ui/Toast';
import { JurisdictionStatus, LogType } from '@rulesharvester/shared';
import type { JurisdictionMeta, DiscoveryCandidate } from '@rulesharvester/shared';

type CrawlMode = 'auto' | 'url' | 'manual';

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

export function CrawlerView() {
  const { jurisdictions, groupedJurisdictions } = useJurisdictionsStore();
  const { createJob } = useJobsStore();
  const { addLog } = useUIStore();

  const [crawlMode, setCrawlMode] = useState<CrawlMode>('auto');
  const [crawlProgress, setCrawlProgress] = useState<Map<string, CrawlProgress>>(new Map());

  // URL crawl mode state
  const [crawlUrl, setCrawlUrl] = useState('');
  const [selectedJurisdictionForUrl, setSelectedJurisdictionForUrl] = useState('');
  const [maxPages, setMaxPages] = useState(20);
  const [isUrlCrawling, setIsUrlCrawling] = useState(false);
  const [urlCrawlResult, setUrlCrawlResult] = useState<CrawlResult | null>(null);

  // Manual mode state (fallback)
  const [manualJurisdiction, setManualJurisdiction] = useState('');
  const [manualText, setManualText] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // Discovered candidates from crawls
  const [discoveredCandidates, setDiscoveredCandidates] = useState<DiscoveryCandidate[]>([]);

  // Filter jurisdictions with court websites configured
  const crawlableJurisdictions = useMemo(() => {
    return jurisdictions.filter(j => j.courtWebsite || j.scraperConfig?.baseUrl);
  }, [jurisdictions]);

  // Auto-crawl a jurisdiction with configured court website
  const handleAutoCrawl = async (jurisdiction: JurisdictionMeta) => {
    const crawlUrl = jurisdiction.scraperConfig?.baseUrl || jurisdiction.courtWebsite;
    if (!crawlUrl) {
      addLog(`No court website configured for ${jurisdiction.name}`, LogType.WARN);
      toast.error('No court website configured');
      return;
    }

    setCrawlProgress(prev => new Map(prev).set(jurisdiction.id, {
      jurisdictionId: jurisdiction.id,
      status: 'crawling',
    }));

    try {
      addLog(`Starting auto-crawl for ${jurisdiction.name}`, LogType.INFO);

      const result = await api.post<CrawlResult>('/discover/crawl', {
        baseUrl: crawlUrl,
        jurisdictionId: jurisdiction.id,
        maxPages: 30,
      });

      setCrawlProgress(prev => new Map(prev).set(jurisdiction.id, {
        jurisdictionId: jurisdiction.id,
        status: 'completed',
        pagesScraped: result.pagesScraped,
        candidatesFound: result.candidatesFound,
      }));

      addLog(
        `Crawled ${result.pagesScraped} pages, found ${result.candidatesFound} rule candidates for ${jurisdiction.name}`,
        LogType.SUCCESS
      );
      toast.success(`Found ${result.candidatesFound} rule candidates`);

      // Fetch discovered candidates
      if (result.candidatesFound > 0) {
        const candidates = await api.get<DiscoveryCandidate[]>(`/discover/${jurisdiction.id}`);
        setDiscoveredCandidates(prev => [...prev, ...candidates.filter(c => c.status === 'DISCOVERED')]);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Crawl failed';
      setCrawlProgress(prev => new Map(prev).set(jurisdiction.id, {
        jurisdictionId: jurisdiction.id,
        status: 'error',
        error: errorMsg,
      }));
      addLog(`Failed to crawl ${jurisdiction.name}: ${errorMsg}`, LogType.ERROR);
      toast.error('Crawl failed');
    }
  };

  // Crawl a custom URL
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
      addLog(
        `Crawled ${result.pagesScraped} pages, found ${result.candidatesFound} rule candidates`,
        LogType.SUCCESS
      );
      toast.success(`Found ${result.candidatesFound} rule candidates`);

      // Fetch discovered candidates if jurisdiction was specified
      if (selectedJurisdictionForUrl && result.candidatesFound > 0) {
        const candidates = await api.get<DiscoveryCandidate[]>(`/discover/${selectedJurisdictionForUrl}`);
        setDiscoveredCandidates(prev => [...prev, ...candidates.filter(c => c.status === 'DISCOVERED')]);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Crawl failed';
      addLog(`URL crawl failed: ${errorMsg}`, LogType.ERROR);
      toast.error(errorMsg);
    } finally {
      setIsUrlCrawling(false);
    }
  };

  // Manual text entry (fallback)
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

  // Acquire a discovered candidate
  const handleAcquireCandidate = async (candidate: DiscoveryCandidate) => {
    try {
      await api.post(`/discover/${candidate.id}/acquire`);
      setDiscoveredCandidates(prev => prev.filter(c => c.id !== candidate.id));
      addLog(`Started extraction for ${candidate.ruleId}`, LogType.SUCCESS);
      toast.success('Extraction started');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to acquire';
      addLog(`Failed to acquire candidate: ${msg}`, LogType.ERROR);
      toast.error(msg);
    }
  };

  // Reject a discovered candidate
  const handleRejectCandidate = async (candidate: DiscoveryCandidate) => {
    try {
      await api.post(`/discover/${candidate.id}/reject`);
      setDiscoveredCandidates(prev => prev.filter(c => c.id !== candidate.id));
      addLog(`Rejected candidate ${candidate.ruleId}`, LogType.INFO);
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  // Acquire all discovered candidates
  const handleAcquireAll = async () => {
    if (discoveredCandidates.length === 0) return;

    try {
      const result = await api.post<{ queued: number; total: number }>('/discover/batch/acquire', {
        candidateIds: discoveredCandidates.map(c => c.id),
      });
      setDiscoveredCandidates([]);
      addLog(`Started extraction for ${result.queued} rules`, LogType.SUCCESS);
      toast.success(`${result.queued} extractions started`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to acquire';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Rule Crawler</h1>
        <p className="text-text-secondary">Automatically discover and extract procedural rules from court websites</p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2" role="tablist">
        <button
          role="tab"
          aria-selected={crawlMode === 'auto'}
          onClick={() => setCrawlMode('auto')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            crawlMode === 'auto'
              ? 'bg-amber-500 text-black'
              : 'bg-surface-elevated text-text-secondary hover:bg-border'
          }`}
        >
          Auto-Crawl
        </button>
        <button
          role="tab"
          aria-selected={crawlMode === 'url'}
          onClick={() => setCrawlMode('url')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            crawlMode === 'url'
              ? 'bg-amber-500 text-black'
              : 'bg-surface-elevated text-text-secondary hover:bg-border'
          }`}
        >
          URL Discovery
        </button>
        <button
          role="tab"
          aria-selected={crawlMode === 'manual'}
          onClick={() => setCrawlMode('manual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            crawlMode === 'manual'
              ? 'bg-amber-500 text-black'
              : 'bg-surface-elevated text-text-secondary hover:bg-border'
          }`}
        >
          Manual Entry
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content Area */}
        <div className="col-span-12 lg:col-span-8">
          {/* Auto-Crawl Mode */}
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
                    <p className="text-text-secondary mb-2">No jurisdictions have court websites configured</p>
                    <p className="text-sm text-text-muted">
                      Use the Cartographer to discover court websites, or use URL Discovery mode
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Federal Circuits */}
                    {groupedJurisdictions?.federalCircuits.filter(j => j.courtWebsite || j.scraperConfig?.baseUrl).length ? (
                      <div>
                        <h4 className="text-sm font-medium text-text-secondary mb-2">Federal Circuits</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {groupedJurisdictions.federalCircuits
                            .filter(j => j.courtWebsite || j.scraperConfig?.baseUrl)
                            .map(j => (
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

                    {/* Federal Districts */}
                    {groupedJurisdictions?.federalDistricts.filter(j => j.courtWebsite || j.scraperConfig?.baseUrl).length ? (
                      <div>
                        <h4 className="text-sm font-medium text-text-secondary mb-2">Federal Districts</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {groupedJurisdictions.federalDistricts
                            .filter(j => j.courtWebsite || j.scraperConfig?.baseUrl)
                            .map(j => (
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

                    {/* States */}
                    {groupedJurisdictions?.states.filter(j => j.courtWebsite || j.scraperConfig?.baseUrl).length ? (
                      <div>
                        <h4 className="text-sm font-medium text-text-secondary mb-2">State Courts</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {groupedJurisdictions.states
                            .filter(j => j.courtWebsite || j.scraperConfig?.baseUrl)
                            .map(j => (
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

          {/* URL Discovery Mode */}
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
                      <label className="block text-sm font-medium mb-2">
                        Associate with Jurisdiction (optional)
                      </label>
                      <select
                        value={selectedJurisdictionForUrl}
                        onChange={(e) => setSelectedJurisdictionForUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">None (just explore)</option>
                        {jurisdictions.map(j => (
                          <option key={j.id} value={j.id}>{j.name} ({j.code})</option>
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

                  <Button
                    onClick={handleUrlCrawl}
                    isLoading={isUrlCrawling}
                    disabled={!crawlUrl}
                    className="w-full"
                  >
                    Start Crawling
                  </Button>

                  {/* URL Crawl Results */}
                  {urlCrawlResult && (
                    <div className="mt-4 p-4 bg-surface-elevated rounded-lg">
                      <h4 className="font-medium mb-2">Crawl Results</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-text-muted">Pages Scraped</p>
                          <p className="text-lg font-semibold text-amber-400">{urlCrawlResult.pagesScraped}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Candidates Found</p>
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
                      {urlCrawlResult.errorDetails && urlCrawlResult.errorDetails.length > 0 && (
                        <details className="mt-3">
                          <summary className="text-sm text-text-muted cursor-pointer">
                            View errors ({urlCrawlResult.errorDetails.length})
                          </summary>
                          <ul className="mt-2 text-xs text-rose-400 space-y-1">
                            {urlCrawlResult.errorDetails.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Entry Mode (Fallback) */}
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
                  Use this only when automated crawling doesn't work. Paste the rule text directly for extraction.
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
                      {jurisdictions.map(j => (
                        <option key={j.id} value={j.id}>{j.name} ({j.code})</option>
                      ))}
                    </select>
                  </div>

                  <Textarea
                    label="Rule Text"
                    placeholder="Paste the complete rule text here..."
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
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
                  <p className="text-xs text-text-muted mt-1">
                    Crawl a jurisdiction to discover rules
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {discoveredCandidates.map(candidate => (
                    <div
                      key={candidate.id}
                      className="p-3 bg-surface-elevated rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{candidate.ruleId}</p>
                          <p className="text-xs text-text-muted truncate">{candidate.jurisdiction}</p>
                          <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                            {candidate.snippet}
                          </p>
                        </div>
                        <Badge
                          variant={
                            candidate.relevanceScore >= 80 ? 'success' :
                            candidate.relevanceScore >= 50 ? 'warning' : 'error'
                          }
                        >
                          {candidate.relevanceScore}%
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAcquireCandidate(candidate)}
                        >
                          Extract
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRejectCandidate(candidate)}
                        >
                          Skip
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

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">{crawlableJurisdictions.length}</p>
            <p className="text-sm text-text-secondary">Crawlable</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">
              {Array.from(crawlProgress.values()).filter(p => p.status === 'crawling').length}
            </p>
            <p className="text-sm text-text-secondary">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-emerald-400">
              {Array.from(crawlProgress.values())
                .filter(p => p.status === 'completed')
                .reduce((acc, p) => acc + (p.candidatesFound || 0), 0)}
            </p>
            <p className="text-sm text-text-secondary">Rules Found</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-purple-400">{discoveredCandidates.length}</p>
            <p className="text-sm text-text-secondary">Pending Review</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Card component for jurisdiction auto-crawl
interface JurisdictionCrawlCardProps {
  jurisdiction: JurisdictionMeta;
  progress?: CrawlProgress;
  onCrawl: () => void;
}

function JurisdictionCrawlCard({ jurisdiction, progress, onCrawl }: JurisdictionCrawlCardProps) {
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
          ? 'bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30'
          : hasError
          ? 'bg-rose-500/20 border border-rose-500/50 hover:bg-rose-500/30'
          : jurisdiction.status === JurisdictionStatus.SYNCED
          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-transparent'
          : 'bg-surface-elevated hover:bg-border border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{jurisdiction.code.replace(/^(FED-|DIST-|ST-)/, '')}</span>
        {isCrawling && <Spinner size="sm" />}
        {isCompleted && (
          <Badge variant="success" className="text-xs">{progress.candidatesFound}</Badge>
        )}
        {hasError && <Badge variant="error" className="text-xs">!</Badge>}
      </div>
      <p className="text-xs text-text-muted truncate">
        {isCrawling
          ? `Crawling... (${progress.pagesScraped || 0} pages)`
          : isCompleted
          ? `${progress.candidatesFound} rules found`
          : hasError
          ? progress.error?.slice(0, 30)
          : jurisdiction.ruleCount > 0
          ? `${jurisdiction.ruleCount} existing rules`
          : 'Click to crawl'}
      </p>
    </button>
  );
}
