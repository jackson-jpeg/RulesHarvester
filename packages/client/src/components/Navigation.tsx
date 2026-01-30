import { useUIStore } from '../store/uiStore';

type TabId =
  | 'dashboard'
  | 'crawler'
  | 'library'
  | 'workflow'
  | 'conflicts'
  | 'verify'
  | 'export'
  | 'settings';

interface NavItem {
  id: TabId;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'crawler', label: 'Crawler', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'library', label: 'Library', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { id: 'workflow', label: 'Jobs', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { id: 'conflicts', label: 'Conflicts', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { id: 'verify', label: 'Verify', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'export', label: 'Export', icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

export function Navigation() {
  const { activeTab, setActiveTab } = useUIStore();

  return (
    <nav
      className="flex items-center justify-center gap-1 p-2 bg-surface border-t border-border"
      role="navigation"
      aria-label="Main navigation"
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`
            flex flex-col items-center gap-1 px-4 py-2 rounded-lg
            transition-colors duration-150
            ${
              activeTab === item.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
            }
          `}
          aria-current={activeTab === item.id ? 'page' : undefined}
        >
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
          <span className="text-xs font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
