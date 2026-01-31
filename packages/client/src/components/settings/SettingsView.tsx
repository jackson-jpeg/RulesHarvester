import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Spinner';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';
import { toast } from '../ui/Toast';

interface SystemStatus {
  database: { connected: boolean; provider: string };
  redis: { connected: boolean; url: string };
  queue: { waiting: number; active: number; completed: number; failed: number };
  cartographer: { jurisdictionsWithConfig: number; totalJurisdictions: number; coverage: number };
  watchtower: { autoSyncEnabled: number; recentScans: number };
  environment: string;
  version: string;
}

const SETTINGS_KEY = 'rulesharvester-settings';

interface AppSettings {
  maxConcurrentJobs: number;
  confidenceThreshold: number;
  autoRetryFailed: boolean;
  enableDebugLogs: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  maxConcurrentJobs: 3,
  confidenceThreshold: 70,
  autoRetryFailed: true,
  enableDebugLogs: false,
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function SettingsView() {
  const { isAutoHarvesting, setAutoHarvesting, clearLogs, addLog } = useUIStore();

  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Load settings and system status on mount
  useEffect(() => {
    setSettings(loadSettings());
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const status = await api.get<SystemStatus>('/stats/system');
      setSystemStatus(status);
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Track changes
  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveSettings(settings);
    setHasChanges(false);
    addLog('Settings saved', 'success');
    toast.success('Settings saved successfully');
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      localStorage.clear();
      addLog('Local data cleared', 'warn');
      toast.warning('Local data cleared');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-text-secondary">Configure RulesHarvester</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Extraction Settings */}
        <Card>
          <CardHeader>Extraction Settings</CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-Harvesting</p>
                <p className="text-sm text-text-muted">
                  Automatically extract rules from idle jurisdictions
                </p>
              </div>
              <button
                onClick={() => setAutoHarvesting(!isAutoHarvesting)}
                className={`
                  relative w-12 h-6 rounded-full transition-colors
                  ${isAutoHarvesting ? 'bg-amber-500' : 'bg-surface-elevated'}
                `}
              >
                <span
                  className={`
                    absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform
                    ${isAutoHarvesting ? 'translate-x-6' : ''}
                  `}
                />
              </button>
            </div>

            <Input
              label="Max Concurrent Jobs"
              type="number"
              value={settings.maxConcurrentJobs}
              onChange={(e) =>
                updateSettings({ maxConcurrentJobs: parseInt(e.target.value) || 1 })
              }
              helperText="Maximum number of extraction jobs running simultaneously"
            />

            <Input
              label="Confidence Threshold (%)"
              type="number"
              value={settings.confidenceThreshold}
              onChange={(e) =>
                updateSettings({ confidenceThreshold: parseInt(e.target.value) || 0 })
              }
              helperText="Rules below this threshold will be flagged for review"
            />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-Retry Failed Jobs</p>
                <p className="text-sm text-text-muted">
                  Automatically retry failed extractions
                </p>
              </div>
              <button
                onClick={() =>
                  updateSettings({ autoRetryFailed: !settings.autoRetryFailed })
                }
                className={`
                  relative w-12 h-6 rounded-full transition-colors
                  ${settings.autoRetryFailed ? 'bg-amber-500' : 'bg-surface-elevated'}
                `}
              >
                <span
                  className={`
                    absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform
                    ${settings.autoRetryFailed ? 'translate-x-6' : ''}
                  `}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span>System Status</span>
              <Button variant="ghost" size="sm" onClick={fetchSystemStatus}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStatus ? (
              <div className="space-y-3">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            ) : systemStatus ? (
              <>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Version</span>
                  <Badge variant="info">v{systemStatus.version}</Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Environment</span>
                  <Badge variant={systemStatus.environment === 'production' ? 'warning' : 'default'}>
                    {systemStatus.environment}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Database</span>
                  <Badge variant={systemStatus.database.connected ? 'success' : 'error'}>
                    {systemStatus.database.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Redis Queue</span>
                  <Badge variant={systemStatus.redis.connected ? 'success' : 'warning'}>
                    {systemStatus.redis.connected ? 'Active' : 'In-Memory Mode'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-text-secondary">AI Model</span>
                  <span className="font-mono text-sm">claude-sonnet-4</span>
                </div>
              </>
            ) : (
              <p className="text-text-muted">Failed to load system status</p>
            )}
          </CardContent>
        </Card>

        {/* Cartographer & Watchtower Status */}
        <Card>
          <CardHeader>AI Services Status</CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStatus ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : systemStatus ? (
              <>
                {/* Cartographer */}
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Cartographer</span>
                    <Badge variant="info">{systemStatus.cartographer.coverage}% coverage</Badge>
                  </div>
                  <p className="text-sm text-text-muted">
                    {systemStatus.cartographer.jurisdictionsWithConfig} of {systemStatus.cartographer.totalJurisdictions} jurisdictions
                    have AI-discovered scraper configs
                  </p>
                </div>

                {/* Watchtower */}
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Watchtower</span>
                    <Badge variant={systemStatus.watchtower.autoSyncEnabled > 0 ? 'success' : 'warning'}>
                      {systemStatus.watchtower.autoSyncEnabled} auto-sync
                    </Badge>
                  </div>
                  <p className="text-sm text-text-muted">
                    {systemStatus.watchtower.recentScans} change detection scans in last 24h
                  </p>
                </div>

                {/* Queue Stats */}
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Job Queue</span>
                    <Badge variant={systemStatus.queue.active > 0 ? 'warning' : 'default'}>
                      {systemStatus.queue.active} active
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div>
                      <p className="text-text-muted">Waiting</p>
                      <p className="font-medium">{systemStatus.queue.waiting}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Active</p>
                      <p className="font-medium text-amber-400">{systemStatus.queue.active}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Done</p>
                      <p className="font-medium text-emerald-400">{systemStatus.queue.completed}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Failed</p>
                      <p className="font-medium text-rose-400">{systemStatus.queue.failed}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Debug Settings */}
        <Card>
          <CardHeader>Debug & Logging</CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Debug Logs</p>
                <p className="text-sm text-text-muted">
                  Show detailed AI processing logs
                </p>
              </div>
              <button
                onClick={() =>
                  updateSettings({ enableDebugLogs: !settings.enableDebugLogs })
                }
                className={`
                  relative w-12 h-6 rounded-full transition-colors
                  ${settings.enableDebugLogs ? 'bg-amber-500' : 'bg-surface-elevated'}
                `}
              >
                <span
                  className={`
                    absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform
                    ${settings.enableDebugLogs ? 'translate-x-6' : ''}
                  `}
                />
              </button>
            </div>

            <Button variant="secondary" className="w-full" onClick={clearLogs}>
              Clear System Logs
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card>
          <CardHeader>
            <span className="text-rose-400">Danger Zone</span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-rose-500/10 rounded-lg border border-rose-500/30">
              <p className="font-medium text-rose-400 mb-2">Clear All Local Data</p>
              <p className="text-sm text-text-muted mb-4">
                This will clear all cached data and settings. Database records will not be affected.
              </p>
              <Button variant="danger" onClick={handleClearData}>
                Clear Local Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2 items-center">
        {hasChanges && (
          <span className="text-sm text-amber-400">Unsaved changes</span>
        )}
        <Button onClick={handleSave} disabled={!hasChanges}>
          Save Settings
        </Button>
      </div>
    </div>
  );
}
