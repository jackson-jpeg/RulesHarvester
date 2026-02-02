import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Spinner';
import { Tooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';
import { ProgressFunnel } from './ProgressFunnel';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useJobsStore } from '../../store/jobsStore';
import { useRulesStore } from '../../store/rulesStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { JobStatus, JurisdictionStatus, LogType } from '@rulesharvester/shared';
import type { SystemLog } from '@rulesharvester/shared';

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

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [velocity, setVelocity] = useState<{ date: string; count: number }[]>([]);
  const [complexity, setComplexity] = useState<{ name: string; value: number }[]>([]);
  const [dbLogs, setDbLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  const { groupedJurisdictions, selectJurisdiction } = useJurisdictionsStore();
  const { jobs } = useJobsStore();
  const { rules } = useRulesStore();
  const { setActiveTab, systemLogs } = useUIStore();

  // Merge DB logs with SSE logs, dedupe by ID
  const allLogs = useCallback(() => {
    const sseLogIds = new Set(systemLogs.map((l) => l.id));
    const uniqueDbLogs = dbLogs.filter((l) => !sseLogIds.has(l.id));
    return [...systemLogs, ...uniqueDbLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  }, [systemLogs, dbLogs]);

  const fetchStats = async () => {
    try {
      const [statsData, velocityData, complexityData, systemData, logsData] = await Promise.all([
        api.get<DashboardStats>('/stats'),
        api.get<{ date: string; count: number }[]>('/stats/velocity'),
        api.get<{ low: number; medium: number; high: number }>('/stats/complexity'),
        api.get<SystemStatus>('/stats/system'),
        api.get<DBSystemLog[]>('/stats/logs?limit=20'),
      ]);

      setStats(statsData);
      setSystemStatus(systemData);
      setVelocity(velocityData);
      setComplexity([
        { name: 'Low (1-3)', value: complexityData.low },
        { name: 'Medium (4-6)', value: complexityData.medium },
        { name: 'High (7-10)', value: complexityData.high },
      ]);
      // Convert DB logs to SystemLog format
      setDbLogs(
        logsData.map((l) => ({
          id: l.id,
          message: l.message,
          type: l.type as SystemLog['type'],
          timestamp: new Date(l.createdAt),
          metadata: l.metadata,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleJurisdictionClick = (jurisdictionId: string) => {
    const all = groupedJurisdictions
      ? [
          ...groupedJurisdictions.federalCircuits,
          ...groupedJurisdictions.federalDistricts,
          ...groupedJurisdictions.states,
        ]
      : [];
    const jurisdiction = all.find((j) => j.id === jurisdictionId);
    if (jurisdiction) {
      selectJurisdiction(jurisdiction);
      setActiveTab('jurisdiction-detail');
    }
  };

  // Get rule count per jurisdiction
  const getRuleCount = (jurisdictionId: string) => {
    return rules.filter((r) => r.jurisdictionId === jurisdictionId).length;
  };

  // Get last sync date
  const getLastSync = (lastSyncedAt?: Date | string | null) => {
    if (!lastSyncedAt) return 'Never synced';
    const date = new Date(lastSyncedAt);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <Skeleton className="col-span-8 h-80" />
          <Skeleton className="col-span-4 h-80" />
        </div>
      </div>
    );
  }

  const hasVelocityData = velocity.some((v) => v.count > 0);
  const hasComplexityData = complexity.some((c) => c.value > 0);
  const mergedLogs = allLogs();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-text-secondary">Overview of rule extraction system</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setActiveTab('crawler')}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            New Extraction
          </Button>
          <button
            onClick={() => { setLoading(true); fetchStats(); }}
            className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
            title="Refresh stats"
            aria-label="Refresh dashboard statistics"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Grid - Clickable Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
        <button
          onClick={() => setActiveTab('library')}
          className="text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
        >
          <Card className="h-full hover:border-emerald-500/50 transition-colors cursor-pointer">
            <CardContent>
              <p className="text-sm text-text-secondary">Synced</p>
              <p className="text-3xl font-bold text-emerald-400">
                {stats?.syncedJurisdictions || 0}/{stats?.totalJurisdictions || 0}
              </p>
              <p className="text-xs text-text-muted mt-1">Click to view</p>
            </CardContent>
          </Card>
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          className="text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
        >
          <Card className="h-full hover:border-blue-500/50 transition-colors cursor-pointer">
            <CardContent>
              <p className="text-sm text-text-secondary">Pending Jobs</p>
              <p className="text-3xl font-bold text-blue-400">
                {stats?.pendingJobs || jobs.filter((j) => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING).length}
              </p>
              <p className="text-xs text-text-muted mt-1">Click to view</p>
            </CardContent>
          </Card>
        </button>
        <button
          onClick={() => setActiveTab('conflicts')}
          className="text-left focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-lg"
        >
          <Card className="h-full hover:border-rose-500/50 transition-colors cursor-pointer">
            <CardContent>
              <p className="text-sm text-text-secondary">Conflicts</p>
              <p className="text-3xl font-bold text-rose-400">
                {stats?.unresolvedConflicts || 0}
              </p>
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
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-text-secondary">Confidence</p>
            <p className="text-3xl font-bold text-cyan-400">
              {((stats?.avgConfidenceScore || 0)).toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Jurisdiction Mesh */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>Jurisdictional Mesh</CardHeader>
          <CardContent>
            {groupedJurisdictions && (
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
                            {ruleCount > 0 && (
                              <span className="ml-1 text-xs opacity-75">({ruleCount})</span>
                            )}
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

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
                            {ruleCount > 0 && (
                              <span className="ml-1 opacity-75">({ruleCount})</span>
                            )}
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extraction Velocity */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>Extraction Velocity</CardHeader>
          <CardContent className="h-64">
            {hasVelocityData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={velocity}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#f59e0b"
                    fillOpacity={1}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="No extraction data yet"
                description="Start extracting rules to see velocity trends"
                action={{
                  label: 'New Extraction',
                  onClick: () => setActiveTab('crawler'),
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Progress Funnel */}
        <div className="col-span-12 md:col-span-4">
          <ProgressFunnel />
        </div>

        {/* Complexity Distribution */}
        <Card className="col-span-12 md:col-span-4">
          <CardHeader>Complexity Distribution</CardHeader>
          <CardContent className="h-48">
            {hasComplexityData ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={complexity}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {complexity.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#161b22',
                        border: '1px solid #30363d',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {complexity.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index] }}
                      />
                      <span className="text-xs text-text-secondary">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="No complexity data"
                description="Extract rules to see complexity distribution"
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card className="col-span-12 md:col-span-4">
          <CardHeader>Recent Jobs</CardHeader>
          <CardContent>
            {jobs.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {jobs.slice(0, 5).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{job.jurisdictionCode}</p>
                      <p className="text-xs text-text-muted">{job.currentStep}</p>
                    </div>
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
                      {job.progress}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No jobs yet"
                description="Start by extracting rules from a jurisdiction"
                action={{
                  label: 'New Extraction',
                  onClick: () => setActiveTab('crawler'),
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* System Logs */}
        <Card className="col-span-12">
          <CardHeader>System Logs</CardHeader>
          <CardContent>
            {mergedLogs.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                {mergedLogs.map((log) => (
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
              <EmptyState
                title="No logs yet"
                description="Run an extraction job to see system events"
                action={{
                  label: 'Create Job',
                  onClick: () => setActiveTab('crawler'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
