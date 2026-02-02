import { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { toast } from '../ui/Toast';
import { api } from '../../api/client';

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

export function WatchtowerView() {
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

    // Cleanup timeout on unmount
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, []);

  const handleManualScan = async (frequency?: 'DAILY' | 'WEEKLY') => {
    try {
      setIsScanning(true);
      await api.post('/watchtower/scan', { frequency });
      toast.success('Watchtower scan started');
      // Refresh status after a short delay
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
      <div className="space-y-6 animate-fadeIn">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-rose-400 mb-4">{error}</p>
            <Button onClick={fetchStatus}>Retry</Button>
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
          <h1 className="text-2xl font-bold">Watchtower</h1>
          <p className="text-text-secondary">
            Automated monitoring for court website changes
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-amber-400">
              {status?.enabledJurisdictions || 0}
            </p>
            <p className="text-sm text-text-secondary">Monitored</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">
              {status?.jurisdictions.filter(j => j.syncFrequency === 'DAILY').length || 0}
            </p>
            <p className="text-sm text-text-secondary">Daily Checks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-purple-400">
              {status?.jurisdictions.filter(j => j.syncFrequency === 'WEEKLY').length || 0}
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
              <p className="text-xs text-text-muted">
                Checks jurisdictions with DAILY sync frequency
              </p>
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
              <p className="text-xs text-text-muted">
                Checks jurisdictions with WEEKLY sync frequency
              </p>
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
              No jurisdictions have auto-sync enabled. Enable auto-sync in jurisdiction settings.
            </p>
          ) : (
            <div className="space-y-2">
              {status?.jurisdictions.map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="default">{j.code}</Badge>
                    <span className="text-sm">{j.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={j.syncFrequency === 'DAILY' ? 'info' : 'warning'}
                    >
                      {j.syncFrequency}
                    </Badge>
                    <span className="text-xs text-text-muted">
                      {j.lastSyncedAt
                        ? `Last: ${new Date(j.lastSyncedAt).toLocaleDateString()}`
                        : 'Never synced'}
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
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        (scan.metadata.relevantChanges || 0) > 0
                          ? 'warning'
                          : 'success'
                      }
                    >
                      {scan.metadata.frequency || 'manual'}
                    </Badge>
                    <div>
                      <p className="text-sm">{scan.message}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(scan.createdAt).toLocaleString()}
                      </p>
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

      {/* Recent Changes */}
      <Card>
        <CardHeader>Recent Hash Changes</CardHeader>
        <CardContent>
          {status?.recentChanges.length === 0 ? (
            <p className="text-center text-text-muted py-8">No changes detected yet</p>
          ) : (
            <div className="space-y-2">
              {status?.recentChanges.slice(0, 10).map((change) => (
                <div
                  key={change.id}
                  className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="info">
                      {change.message.replace('WATCHTOWER_HASH: ', '')}
                    </Badge>
                    <div>
                      <p className="text-xs text-text-muted truncate max-w-md">
                        {change.metadata.url || 'Unknown URL'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <code className="text-xs text-text-secondary bg-surface px-2 py-1 rounded">
                      {change.metadata.hash?.slice(0, 8) || 'N/A'}
                    </code>
                    <span className="text-xs text-text-muted">
                      {change.metadata.checkedAt
                        ? new Date(change.metadata.checkedAt).toLocaleString()
                        : new Date(change.createdAt).toLocaleString()}
                    </span>
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
