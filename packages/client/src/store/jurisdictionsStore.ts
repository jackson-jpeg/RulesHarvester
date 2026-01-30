import { create } from 'zustand';
import type { JurisdictionMeta, JurisdictionDNA, PaginatedResponse } from '@rulesharvester/shared';
import { api } from '../api/client';

interface JurisdictionsState {
  jurisdictions: JurisdictionMeta[];
  selectedJurisdiction: JurisdictionMeta | null;
  isLoading: boolean;
  error: string | null;
  groupedJurisdictions: {
    federalCircuits: JurisdictionMeta[];
    federalDistricts: JurisdictionMeta[];
    states: JurisdictionMeta[];
  } | null;

  // Actions
  fetchJurisdictions: () => Promise<void>;
  fetchGroupedJurisdictions: () => Promise<void>;
  fetchJurisdictionById: (id: string) => Promise<void>;
  updateJurisdictionDNA: (id: string, dna: JurisdictionDNA) => Promise<void>;
  updateJurisdictionStatus: (id: string, status: string) => void;
  selectJurisdiction: (jurisdiction: JurisdictionMeta | null) => void;
}

export const useJurisdictionsStore = create<JurisdictionsState>((set) => ({
  jurisdictions: [],
  selectedJurisdiction: null,
  isLoading: false,
  error: null,
  groupedJurisdictions: null,

  fetchJurisdictions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<PaginatedResponse<JurisdictionMeta>>(
        '/jurisdictions?pageSize=200'
      );
      set({ jurisdictions: response.items, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch jurisdictions',
        isLoading: false,
      });
    }
  },

  fetchGroupedJurisdictions: async () => {
    set({ isLoading: true, error: null });
    try {
      const grouped = await api.get<{
        federalCircuits: JurisdictionMeta[];
        federalDistricts: JurisdictionMeta[];
        states: JurisdictionMeta[];
      }>('/jurisdictions/grouped/by-type');
      set({
        groupedJurisdictions: grouped,
        jurisdictions: [
          ...grouped.federalCircuits,
          ...grouped.federalDistricts,
          ...grouped.states,
        ],
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch jurisdictions',
        isLoading: false,
      });
    }
  },

  fetchJurisdictionById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const jurisdiction = await api.get<JurisdictionMeta>(`/jurisdictions/${id}`);
      set({ selectedJurisdiction: jurisdiction, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch jurisdiction',
        isLoading: false,
      });
    }
  },

  updateJurisdictionDNA: async (id: string, dna: JurisdictionDNA) => {
    try {
      await api.patch(`/jurisdictions/${id}/dna`, { dna });
      set((state) => ({
        jurisdictions: state.jurisdictions.map((j) =>
          j.id === id ? { ...j, dna } : j
        ),
        selectedJurisdiction:
          state.selectedJurisdiction?.id === id
            ? { ...state.selectedJurisdiction, dna }
            : state.selectedJurisdiction,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update DNA',
      });
    }
  },

  updateJurisdictionStatus: (id, status) => {
    set((state) => ({
      jurisdictions: state.jurisdictions.map((j) =>
        j.id === id ? { ...j, status: status as JurisdictionMeta['status'] } : j
      ),
    }));
  },

  selectJurisdiction: (jurisdiction) => {
    set({ selectedJurisdiction: jurisdiction });
  },
}));
