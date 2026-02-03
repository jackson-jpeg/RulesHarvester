import { useUIStore, type TabId } from '../store/uiStore';
import { useRulesStore } from '../store/rulesStore';
import { useEffect } from 'react';
import { api } from '../api/client';

interface NavItem {
  id: TabId;
  label: string;
  icon: string;
}

// Simplified 5-tab navigation
const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    id: 'collect',
    label: 'Collect',
    icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  },
  {
    id: 'library',
    label: 'Library',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    id: 'monitor',
    label: 'Monitor',
    icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

export function Navigation() {
  const {
    activeTab,
    setActiveTab,
    conflictCount,
    setConflictCount,
    inboxCount,
    setInboxCount,
    activeJobCount,
  } = useUIStore();
  const { rules } = useRulesStore();

  // Initial fetch of conflict count and inbox count - SSE handles updates
  useEffect(() => {
    const fetchConflictCount = async () => {
      try {
        const response = await api.get<{ items: { status: string }[] }>('/conflicts');
        const unresolved = response.items?.filter((c) => c.status === 'UNRESOLVED').length || 0;
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

  // Badge counts for each nav item
  const getBadgeCount = (id: TabId): number | null => {
    switch (id) {
      case 'home':
        return inboxCount > 0 ? inboxCount : null;
      case 'collect':
        return activeJobCount > 0 ? activeJobCount : null;
      case 'library':
        return rules.length > 0 ? rules.length : null;
      case 'monitor':
        return conflictCount > 0 ? conflictCount : null;
      default:
        return null;
    }
  };

  // Badge variant for each nav item
  const getBadgeVariant = (id: TabId): 'info' | 'warning' | 'error' => {
    switch (id) {
      case 'monitor':
        return 'error';
      case 'home':
        return 'warning';
      case 'collect':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <nav
      className="flex items-center justify-center gap-2 p-2 bg-surface border-t border-border"
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
              relative flex flex-col items-center gap-1 px-5 py-2 rounded-lg
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {badgeCount !== null && (
                <span
                  className={`
                    absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1
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
