import { create } from 'zustand';
import type { SystemLog, AIAgent } from '@rulesharvester/shared';
import { AgentStatus } from '@rulesharvester/shared';

type TabId =
  | 'dashboard'
  | 'crawler'
  | 'library'
  | 'workflow'
  | 'conflicts'
  | 'verify'
  | 'export'
  | 'settings'
  | 'jurisdiction-detail';

interface UIState {
  activeTab: TabId;
  systemLogs: SystemLog[];
  agents: AIAgent[];
  isAutoHarvesting: boolean;
  sidebarOpen: boolean;

  // Actions
  setActiveTab: (tab: TabId) => void;
  addLog: (message: string, type: SystemLog['type'], metadata?: Record<string, unknown>) => void;
  clearLogs: () => void;
  updateAgentStatus: (agentId: string, status: AIAgent['status'], task?: string) => void;
  setAutoHarvesting: (enabled: boolean) => void;
  toggleSidebar: () => void;
}

const MAX_LOGS = 50;

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'dashboard',
  systemLogs: [],
  agents: [
    { id: 'agent-formalist', persona: 'Formalist', status: AgentStatus.IDLE },
    { id: 'agent-analyst', persona: 'Analyst', status: AgentStatus.IDLE },
    { id: 'agent-historian', persona: 'Historian', status: AgentStatus.IDLE },
  ],
  isAutoHarvesting: false,
  sidebarOpen: true,

  setActiveTab: (tab) => set({ activeTab: tab }),

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
}));
