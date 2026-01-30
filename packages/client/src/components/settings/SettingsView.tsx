import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { useUIStore } from '../../store/uiStore';

export function SettingsView() {
  const { isAutoHarvesting, setAutoHarvesting, clearLogs, addLog } = useUIStore();

  const [settings, setSettings] = useState({
    maxConcurrentJobs: 3,
    confidenceThreshold: 70,
    autoRetryFailed: true,
    enableDebugLogs: false,
  });

  const handleSave = () => {
    // Would save to backend/localStorage
    addLog('Settings saved', 'success');
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      localStorage.clear();
      addLog('Local data cleared', 'warn');
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
                setSettings({ ...settings, maxConcurrentJobs: parseInt(e.target.value) })
              }
              helperText="Maximum number of extraction jobs running simultaneously"
            />

            <Input
              label="Confidence Threshold (%)"
              type="number"
              value={settings.confidenceThreshold}
              onChange={(e) =>
                setSettings({ ...settings, confidenceThreshold: parseInt(e.target.value) })
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
                  setSettings({ ...settings, autoRetryFailed: !settings.autoRetryFailed })
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
          <CardHeader>System Information</CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-text-secondary">Version</span>
              <Badge variant="info">v2.0.0</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-text-secondary">AI Model</span>
              <span className="font-mono text-sm">claude-sonnet-4-20250514</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-text-secondary">Database</span>
              <Badge variant="success">Connected</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-text-secondary">Redis Queue</span>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-secondary">SSE Connection</span>
              <Badge variant="success">Connected</Badge>
            </div>
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
                  setSettings({ ...settings, enableDebugLogs: !settings.enableDebugLogs })
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
      <div className="flex justify-end">
        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </div>
  );
}
