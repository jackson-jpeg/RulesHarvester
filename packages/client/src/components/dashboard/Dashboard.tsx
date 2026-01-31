import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Spinner';
import { useJurisdictionsStore } from '../../store/jurisdictionsStore';
import { useJobsStore } from '../../store/jobsStore';
import { useRulesStore } from '../../store/rulesStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [velocity, setVelocity] = useState<{ date: string; count: number }[]>([]);
  const [complexity, setComplexity] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const { groupedJurisdictions, selectJurisdiction } = useJurisdictionsStore();
  const { jobs } = useJobsStore();
  const { rules } = useRulesStore();
  const { setActiveTab, systemLogs } = useUIStore();

  const fetchStats = async () => {
    try {
      const [statsData, velocityData, complexityData, systemData] = await Promise.all([
        api.get<DashboardStats>('/stats'),
        api.get<{ date: string; count: number }[]>('/stats/velocity'),
        api.get<{ low: number; medium: number; high: number }>('/stats/complexity'),
        api.get<SystemStatus>('/stats/system'),
      ]);

      setStats(statsData);
      setSystemStatus(systemData);
      setVelocity(velocityData);
      setComplexity([
        { name: 'Low (1-3)', value: complexityData.low },
        { name: 'Medium (4-6)', value: complexityData.medium },
        { name: 'High (7-10)', value: complexityData.high },
      ]);
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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-text-secondary">Overview of rule extraction system</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchStats(); }}
          className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
          title="Refresh stats"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent>
            <p className="text-sm text-text-secondary">Total Rules</p>
            <p className="text-3xl font-bold text-amber-400">
              {stats?.totalRules || rules.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-text-secondary">Synced</p>
            <p className="text-3xl font-bold text-emerald-400">
              {stats?.syncedJurisdictions || 0}/{stats?.totalJurisdictions || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-text-secondary">Pending Jobs</p>
            <p className="text-3xl font-bold text-blue-400">
              {stats?.pendingJobs || jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-text-secondary">Conflicts</p>
            <p className="text-3xl font-bold text-rose-400">
              {stats?.unresolvedConflicts || 0}
            </p>
          </CardContent>
        </Card>
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
                    {groupedJurisdictions.federalCircuits.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => handleJurisdictionClick(j.id)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          j.status === 'synced'
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : j.status === 'harvesting' || j.status === 'searching'
                            ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                            : j.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-surface-elevated text-text-secondary hover:bg-border'
                        }`}
                      >
                        {j.code.replace('FED-', '')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* States */}
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-2">States</h4>
                  <div className="flex flex-wrap gap-2">
                    {groupedJurisdictions.states.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => handleJurisdictionClick(j.id)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          j.status === 'synced'
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : j.status === 'harvesting' || j.status === 'searching'
                            ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                            : j.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-surface-elevated text-text-secondary hover:bg-border'
                        }`}
                      >
                        {j.code.replace('ST-', '')}
                      </button>
                    ))}
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
                <Tooltip
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
          </CardContent>
        </Card>

        {/* Complexity Distribution */}
        <Card className="col-span-12 md:col-span-4">
          <CardHeader>Complexity Distribution</CardHeader>
          <CardContent className="h-48">
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
                <Tooltip
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
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card className="col-span-12 md:col-span-4">
          <CardHeader>Recent Jobs</CardHeader>
          <CardContent>
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
                      job.status === 'completed'
                        ? 'success'
                        : job.status === 'failed'
                        ? 'error'
                        : job.status === 'processing'
                        ? 'warning'
                        : 'default'
                    }
                  >
                    {job.progress}%
                  </Badge>
                </div>
              ))}
              {jobs.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">No jobs yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Logs */}
        <Card className="col-span-12 md:col-span-4">
          <CardHeader>System Logs</CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
              {systemLogs.slice(0, 15).map((log) => (
                <div
                  key={log.id}
                  className={`py-1 ${
                    log.type === 'error'
                      ? 'text-rose-400'
                      : log.type === 'success'
                      ? 'text-emerald-400'
                      : log.type === 'warn'
                      ? 'text-amber-400'
                      : log.type === 'ai'
                      ? 'text-purple-400'
                      : 'text-text-secondary'
                  }`}
                >
                  [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                </div>
              ))}
              {systemLogs.length === 0 && (
                <p className="text-text-muted text-center py-4">No logs yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
