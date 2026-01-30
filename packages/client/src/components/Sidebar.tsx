import { useUIStore } from '../store/uiStore';
import { useJurisdictionsStore } from '../store/jurisdictionsStore';
import { Badge } from './ui/Badge';

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, systemLogs, agents } = useUIStore();
  const { groupedJurisdictions } = useJurisdictionsStore();

  const syncedCount = groupedJurisdictions
    ? [...groupedJurisdictions.federalCircuits, ...groupedJurisdictions.federalDistricts, ...groupedJurisdictions.states].filter(
        (j) => j.status === 'synced'
      ).length
    : 0;

  const totalCount = groupedJurisdictions
    ? groupedJurisdictions.federalCircuits.length +
      groupedJurisdictions.federalDistricts.length +
      groupedJurisdictions.states.length
    : 0;

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full bg-surface border-r border-border
        transition-all duration-300 z-20
        ${sidebarOpen ? 'w-64' : 'w-16'}
      `}
      aria-label="Sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {sidebarOpen && (
          <div>
            <h1 className="text-lg font-bold text-amber-400">RulesHarvester</h1>
            <p className="text-xs text-text-muted">v2.0</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-text-primary"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <svg
            className={`w-5 h-5 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {sidebarOpen && (
        <>
          {/* Stats */}
          <div className="p-4 border-b border-border">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Coverage
            </h2>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-secondary">Jurisdictions</span>
              <span className="text-sm font-mono text-amber-400">
                {syncedCount}/{totalCount}
              </span>
            </div>
            <div className="w-full bg-surface-elevated rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${totalCount > 0 ? (syncedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* AI Agents */}
          <div className="p-4 border-b border-border">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              AI Agents
            </h2>
            <div className="space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      agent.status === 'idle'
                        ? 'bg-text-muted'
                        : agent.status === 'analyzing'
                        ? 'bg-blue-400 animate-pulse'
                        : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span className="text-sm text-text-secondary">{agent.persona}</span>
                  {agent.status !== 'idle' && (
                    <Badge variant="info" className="ml-auto">
                      {agent.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Logs */}
          <div className="p-4 flex-1 overflow-hidden">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              System Logs
            </h2>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {systemLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className={`text-xs py-1 px-2 rounded ${
                    log.type === 'error'
                      ? 'bg-rose-500/10 text-rose-400'
                      : log.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : log.type === 'warn'
                      ? 'bg-amber-500/10 text-amber-400'
                      : log.type === 'ai'
                      ? 'bg-purple-500/10 text-purple-400'
                      : 'bg-surface-elevated text-text-secondary'
                  }`}
                >
                  {log.message}
                </div>
              ))}
              {systemLogs.length === 0 && (
                <p className="text-xs text-text-muted italic">No logs yet</p>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
