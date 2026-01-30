import { create } from 'zustand';
import type { ExtractionJob } from '@rulesharvester/shared';
import { api } from '../api/client';

interface JobsState {
  jobs: ExtractionJob[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchJobs: () => Promise<void>;
  createJob: (jurisdictionId: string, sourceUrl: string, rawText?: string) => Promise<ExtractionJob>;
  cancelJob: (id: string) => Promise<void>;
  retryJob: (id: string) => Promise<void>;
  updateJobProgress: (jobId: string, progress: number, currentStep: string, agentConsensus?: number) => void;
  completeJob: (jobId: string, ruleId: string) => void;
  failJob: (jobId: string, error: string) => void;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  isLoading: false,
  error: null,

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const jobs = await api.get<ExtractionJob[]>('/jobs');
      set({ jobs, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch jobs',
        isLoading: false,
      });
    }
  },

  createJob: async (jurisdictionId: string, sourceUrl: string, rawText?: string) => {
    set({ isLoading: true, error: null });
    try {
      const job = await api.post<ExtractionJob>('/jobs', {
        jurisdictionId,
        sourceUrl,
        rawText,
      });
      set((state) => ({
        jobs: [job, ...state.jobs],
        isLoading: false,
      }));
      return job;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create job',
        isLoading: false,
      });
      throw error;
    }
  },

  cancelJob: async (id: string) => {
    try {
      await api.post(`/jobs/${id}/cancel`);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === id
            ? { ...j, status: 'failed' as const, error: 'Cancelled by user' }
            : j
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to cancel job',
      });
    }
  },

  retryJob: async (id: string) => {
    try {
      await api.post(`/jobs/${id}/retry`);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === id
            ? { ...j, status: 'pending' as const, progress: 0, error: undefined }
            : j
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to retry job',
      });
    }
  },

  updateJobProgress: (jobId, progress, currentStep, agentConsensus) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              progress,
              currentStep,
              agentConsensus,
              status: 'processing' as const,
            }
          : j
      ),
    }));
  },

  completeJob: (jobId, ruleId) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: 'completed' as const,
              progress: 100,
              currentStep: 'Complete',
              ruleId,
            }
          : j
      ),
    }));
  },

  failJob: (jobId, error) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: 'failed' as const,
              error,
              currentStep: 'Failed',
            }
          : j
      ),
    }));
  },
}));
