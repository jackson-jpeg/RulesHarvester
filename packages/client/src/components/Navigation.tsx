import { useUIStore } from '../store/uiStore';
import { useJobsStore } from '../store/jobsStore';
import { useRulesStore } from '../store/rulesStore';
import { useEffect } from 'react';
import { api } from '../api/client';
import { JobStatus } from '@rulesharvester/shared';

type TabId =
  | 'dashboard'
  | 'crawler'
  | 'library'
  | 'workflow'
  | 'conflicts'
  | 'verify'
  | 'export'
  | 'settings'
  | 'watchtower'
  | 'discovery'
  | 'inbox';

interface NavItem {
  id: TabId;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'inbox', label: 'Inbox', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
  { id: 'discovery', label: 'Discover', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { id: 'crawler', label: 'Crawler', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'library', label: 'Library', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { id: 'workflow', label: 'Jobs', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { id: 'conflicts', label: 'Conflicts', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { id: 'verify', label: 'Verify', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'export', label: 'Export', icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'watchtower', label: 'Watch', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
];

export function Navigation() {
  const { activeTab, setActiveTab, conflictCount, setConflictCount, inboxCount, setInboxCount } = useUIStore();
  const { jobs } = useJobsStore();
  const { rules } = useRulesStore();

  // Initial fetch of conflict count and inbox count - SSE handles updates
  useEffect(() => {
    const fetchConflictCount = async () => {
      try {
        const response = await api.get<{ items: { status: string }[] }>('/conflicts');
        const unresolved = response.items?.filter(c => c.status === 'UNRESOLVED').length || 0;
        setConflictCount(unresolved);
      } catch {
        // Silently fail
      }
    };

    const fetchInboxCount = async () => {
      try {
        const response = await api.get<{ pending: number }>('/inbox/stats');
        setInboxCount(response.pending || 0);
      } catch {
        // Silently fail
      }
    };

    fetchConflictCount();
    fetchInboxCount();
  }, [setConflictCount, setInboxCount]);

  const activeJobCount = jobs.filter(j => j.status === JobStatus.PROCESSING || j.status === JobStatus.PENDING).length;

  // Badge counts for each nav item
  const getBadgeCount = (id: TabId): number | null => {
    switch (id) {
      case 'inbox':
        return inboxCount > 0 ? inboxCount : null;
      case 'workflow':
        return activeJobCount > 0 ? activeJobCount : null;
      case 'conflicts':
        return conflictCount > 0 ? conflictCount : null;
      case 'library':
        return rules.length > 0 ? rules.length : null;
      default:
        return null;
    }
  };

  // Badge variant for each nav item
  const getBadgeVariant = (id: TabId): 'info' | 'warning' | 'error' => {
    switch (id) {
      case 'conflicts':
        return 'error';
      case 'inbox':
        return 'warning';
      case 'workflow':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <nav
      className="flex items-center justify-center gap-1 p-2 bg-surface border-t border-border"
      role="navigation"
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const badgeCount = getBadgeCount(item.id);
        const badgeVariant = getBadgeVariant(item.id);

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              relative flex flex-col items-center gap-1 px-4 py-2 rounded-lg
              transition-colors duration-150
              ${
                activeTab === item.id
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              }
            `}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <div className="relative">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={item.icon}
                />
              </svg>
              {badgeCount !== null && (
                <span
                  className={`
                    absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1
                    flex items-center justify-center
                    text-[10px] font-bold rounded-full
                    ${badgeVariant === 'error' ? 'bg-rose-500 text-white' : ''}
                    ${badgeVariant === 'warning' ? 'bg-amber-500 text-black' : ''}
                    ${badgeVariant === 'info' ? 'bg-blue-500 text-white' : ''}
                  `}
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
