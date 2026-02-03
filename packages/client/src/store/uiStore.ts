import { create } from 'zustand';
import type { SystemLog, AIAgent } from '@rulesharvester/shared';
import { AgentStatus, LogType } from '@rulesharvester/shared';

// Simplified 5-tab navigation
type TabId = 'home' | 'collect' | 'library' | 'monitor' | 'settings';

// Sub-tabs within each main view
type CollectSubTab = 'jurisdictions' | 'rules' | 'jobs';
type MonitorSubTab = 'watchtower' | 'conflicts' | 'coverage';

type SSEConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface UIState {
  activeTab: TabId;
  activeSubTab: CollectSubTab | MonitorSubTab | null;
  systemLogs: SystemLog[];
  agents: AIAgent[];
  isAutoHarvesting: boolean;
  sidebarOpen: boolean;
  sseConnectionStatus: SSEConnectionStatus;
  conflictCount: number;
  inboxCount: number;
  activeJobCount: number;

  // Scoped selection - only persists while on Library tab
  librarySelectedRuleId: string | null;

  // Actions
  setActiveTab: (tab: TabId) => void;
  setActiveSubTab: (subTab: CollectSubTab | MonitorSubTab | null) => void;
  addLog: (message: string, type: SystemLog['type'], metadata?: Record<string, unknown>) => void;
  clearLogs: () => void;
  updateAgentStatus: (agentId: string, status: AIAgent['status'], task?: string) => void;
  setAutoHarvesting: (enabled: boolean) => void;
  toggleSidebar: () => void;
  setSSEConnectionStatus: (status: SSEConnectionStatus) => void;
  setConflictCount: (count: number) => void;
  incrementConflictCount: () => void;
  setInboxCount: (count: number) => void;
  incrementInboxCount: () => void;
  decrementInboxCount: () => void;
  setActiveJobCount: (count: number) => void;
  setLibrarySelectedRuleId: (ruleId: string | null) => void;
}

export type { TabId, CollectSubTab, MonitorSubTab };

const MAX_LOGS = 50;

export const useUIStore = create<UIState>((set, get) => ({
  activeTab: 'home',
  activeSubTab: null,
  systemLogs: [],
  agents: [
    { id: 'agent-formalist', persona: 'Formalist', status: AgentStatus.IDLE },
    { id: 'agent-analyst', persona: 'Analyst', status: AgentStatus.IDLE },
    { id: 'agent-historian', persona: 'Historian', status: AgentStatus.IDLE },
  ],
  isAutoHarvesting: false,
  sidebarOpen: true,
  sseConnectionStatus: 'connecting',
  conflictCount: 0,
  inboxCount: 0,
  activeJobCount: 0,
  librarySelectedRuleId: null,

  setActiveTab: (tab) => set({
    activeTab: tab,
    activeSubTab: null,
    // Clear library selection when leaving library tab
    librarySelectedRuleId: tab === 'library' ? get().librarySelectedRuleId : null,
  }),

  setActiveSubTab: (subTab) => set({ activeSubTab: subTab }),

  addLog: (message, type, metadata) => {
    set((state) => {
      const newLog: SystemLog = {
        id: `log-${Date.now()}`,
        message,
        type,
        timestamp: new Date(),
        metadata,
      };

      const logs = [newLog, ...state.systemLogs].slice(0, MAX_LOGS);
      return { systemLogs: logs };
    });
  },

  clearLogs: () => set({ systemLogs: [] }),

  updateAgentStatus: (agentId, status, task) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, status, currentTask: task } : a
      ),
    }));
  },

  setAutoHarvesting: (enabled) => set({ isAutoHarvesting: enabled }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSSEConnectionStatus: (status) => set({ sseConnectionStatus: status }),

  setConflictCount: (count) => set({ conflictCount: count }),

  incrementConflictCount: () => set((state) => ({ conflictCount: state.conflictCount + 1 })),

  setInboxCount: (count) => set({ inboxCount: count }),

  incrementInboxCount: () => set((state) => ({ inboxCount: state.inboxCount + 1 })),

  decrementInboxCount: () => set((state) => ({ inboxCount: Math.max(0, state.inboxCount - 1) })),

  setActiveJobCount: (count) => set({ activeJobCount: count }),

  setLibrarySelectedRuleId: (ruleId) => set({ librarySelectedRuleId: ruleId }),
}));
