import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Skeleton } from '../ui/Spinner';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';

interface FunnelData {
  discoveredSources: number;
  totalJobs: number;
  pendingJobs: number;
  completedJobs: number;
  totalRules: number;
  verifiedRules: number;
  unverifiedRules: number;
  unresolvedConflicts: number;
  resolvedConflicts: number;
  totalConflicts: number;
}

interface FunnelStage {
  id: string;
  label: string;
  value: number;
  total: number;
  color: string;
  navigateTo?: string;
}

export function ProgressFunnel() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  useEffect(() => {
    const fetchFunnel = async () => {
      try {
        const result = await api.get<FunnelData>('/stats/funnel');
        setData(result);
      } catch (error) {
        console.error('Failed to fetch funnel data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFunnel();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>Workflow Progress</CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const maxValue = Math.max(
    data.discoveredSources,
    data.totalJobs,
    data.totalRules,
    data.totalConflicts,
    1
  );

  const stages: FunnelStage[] = [
    {
      id: 'discovered',
      label: 'Discovered',
      value: data.discoveredSources,
      total: data.discoveredSources,
      color: 'bg-blue-500',
      navigateTo: 'discovery',
    },
    {
      id: 'jobs',
      label: 'Jobs',
      value: data.completedJobs,
      total: data.totalJobs,
      color: 'bg-amber-500',
      navigateTo: 'workflow',
    },
    {
      id: 'rules',
      label: 'Rules',
      value: data.verifiedRules,
      total: data.totalRules,
      color: 'bg-emerald-500',
      navigateTo: 'library',
    },
    {
      id: 'conflicts',
      label: 'Conflicts',
      value: data.resolvedConflicts,
      total: data.totalConflicts,
      color: 'bg-rose-500',
      navigateTo: 'conflicts',
    },
  ];

  const handleStageClick = (navigateTo?: string) => {
    if (navigateTo) {
      setActiveTab(navigateTo as Parameters<typeof setActiveTab>[0]);
    }
  };

  return (
    <Card>
      <CardHeader>Workflow Progress</CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((stage) => {
            const widthPercent = maxValue > 0 ? (stage.total / maxValue) * 100 : 0;
            const completionPercent = stage.total > 0 ? (stage.value / stage.total) * 100 : 0;

            return (
              <button
                key={stage.id}
                onClick={() => handleStageClick(stage.navigateTo)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                    {stage.label}
                  </span>
                  <span className="text-xs text-text-muted">
                    {stage.value}/{stage.total}
                    {stage.total > 0 && (
                      <span className="ml-1 text-text-muted">
                        ({Math.round(completionPercent)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div
                  className="h-6 bg-surface-elevated rounded overflow-hidden group-hover:ring-1 group-hover:ring-border transition-all"
                  style={{ width: `${Math.max(widthPercent, 10)}%` }}
                >
                  <div
                    className={`h-full ${stage.color} transition-all duration-500`}
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-text-muted mt-3 text-center">
          Click any stage to view details
        </p>
      </CardContent>
    </Card>
  );
}
