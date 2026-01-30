import { create } from 'zustand';
import type { RuleTemplate, PaginatedResponse } from '@rulesharvester/shared';
import { api } from '../api/client';

interface RulesState {
  rules: RuleTemplate[];
  selectedRule: RuleTemplate | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    jurisdictionId?: string;
    triggerType?: string;
    minConfidence?: number;
    search?: string;
  };

  // Actions
  fetchRules: () => Promise<void>;
  fetchRuleById: (id: string) => Promise<void>;
  updateRule: (id: string, updates: Partial<RuleTemplate>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  setFilters: (filters: RulesState['filters']) => void;
  setPage: (page: number) => void;
  clearSelectedRule: () => void;
  addRule: (rule: RuleTemplate) => void;
}

export const useRulesStore = create<RulesState>((set, get) => ({
  rules: [],
  selectedRule: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  },
  filters: {},

  fetchRules: async () => {
    set({ isLoading: true, error: null });
    try {
      const { pagination, filters } = get();
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
        ...Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
        ),
      });

      const response = await api.get<PaginatedResponse<RuleTemplate>>(`/rules?${params}`);

      set({
        rules: response.items,
        pagination: {
          page: response.page,
          pageSize: response.pageSize,
          total: response.total,
          totalPages: response.totalPages,
        },
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch rules',
        isLoading: false,
      });
    }
  },

  fetchRuleById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const rule = await api.get<RuleTemplate>(`/rules/${id}`);
      set({ selectedRule: rule, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch rule',
        isLoading: false,
      });
    }
  },

  updateRule: async (id: string, updates: Partial<RuleTemplate>) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await api.patch<RuleTemplate>(`/rules/${id}`, updates);
      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? updated : r)),
        selectedRule: state.selectedRule?.id === id ? updated : state.selectedRule,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update rule',
        isLoading: false,
      });
    }
  },

  deleteRule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/rules/${id}`);
      set((state) => ({
        rules: state.rules.filter((r) => r.id !== id),
        selectedRule: state.selectedRule?.id === id ? null : state.selectedRule,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete rule',
        isLoading: false,
      });
    }
  },

  setFilters: (filters) => {
    set({ filters, pagination: { ...get().pagination, page: 1 } });
    get().fetchRules();
  },

  setPage: (page) => {
    set({ pagination: { ...get().pagination, page } });
    get().fetchRules();
  },

  clearSelectedRule: () => set({ selectedRule: null }),

  addRule: (rule) => {
    set((state) => ({
      rules: [rule, ...state.rules],
      pagination: { ...state.pagination, total: state.pagination.total + 1 },
    }));
  },
}));
