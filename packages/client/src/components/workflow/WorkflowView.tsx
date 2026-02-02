import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { ProgressBar } from '../ui/ProgressBar';
import { Spinner } from '../ui/Spinner';
import { useJobsStore } from '../../store/jobsStore';
import { useUIStore } from '../../store/uiStore';
import { JOB_STATUS_CONFIG, JobStatus } from '@rulesharvester/shared';

type StatusFilter = 'all' | 'active' | 'completed' | 'failed';
type SortBy = 'newest' | 'oldest' | 'progress';

export function WorkflowView() {
  const { jobs, isLoading, fetchJobs, cancelJob, retryJob } = useJobsStore();
  const { sseConnectionStatus } = useUIStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

  // Initial fetch only - SSE handles real-time updates
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const activeJobs = jobs.filter((j) => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING);
  const completedJobs = jobs.filter((j) => j.status === JobStatus.COMPLETED);
  const failedJobs = jobs.filter((j) => j.status === JobStatus.FAILED);

  // Filter jobs
  const filteredJobs = useCallback(() => {
    let filtered = [...jobs];

    // Apply status filter
    switch (statusFilter) {
      case 'active':
        filtered = filtered.filter((j) => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING);
        break;
      case 'completed':
        filtered = filtered.filter((j) => j.status === JobStatus.COMPLETED);
        break;
      case 'failed':
        filtered = filtered.filter((j) => j.status === JobStatus.FAILED);
        break;
    }

    // Apply sort
    switch (sortBy) {
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'progress':
        filtered.sort((a, b) => b.progress - a.progress);
        break;
    }

    return filtered;
  }, [jobs, statusFilter, sortBy]);

  const displayedJobs = filteredJobs();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Extraction Workflow</h1>
          <p className="text-text-secondary">
            {jobs.length} total jobs
            {activeJobs.length > 0 && (
              <span className="ml-2 text-amber-400">
                ({activeJobs.length} active)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                sseConnectionStatus === 'connected'
                  ? 'bg-emerald-400'
                  : sseConnectionStatus === 'reconnecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-400'
              }`}
            />
            <span className="text-sm text-text-secondary">
              {sseConnectionStatus === 'connected' ? 'Live' : sseConnectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
            </span>
          </div>
          <Button onClick={() => fetchJobs()} isLoading={isLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-blue-400">{activeJobs.length}</p>
            <p className="text-sm text-text-secondary">Active Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-emerald-400">{completedJobs.length}</p>
            <p className="text-sm text-text-secondary">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-rose-400">{failedJobs.length}</p>
            <p className="text-sm text-text-secondary">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span>Active Extractions</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <JobCard key={job.id} job={job} onCancel={() => cancelJob(job.id)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card padding="sm">
        <CardContent className="flex items-center gap-4">
          <div className="w-40">
            <Select
              value={statusFilter}
              options={[
                { value: 'all', label: 'All Jobs' },
                { value: 'active', label: 'Active' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
              ]}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            />
          </div>
          <div className="w-40">
            <Select
              value={sortBy}
              options={[
                { value: 'newest', label: 'Newest First' },
                { value: 'oldest', label: 'Oldest First' },
                { value: 'progress', label: 'By Progress' },
              ]}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            />
          </div>
          <span className="text-sm text-text-muted">
            Showing {displayedJobs.length} of {jobs.length} jobs
          </span>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader>Job History</CardHeader>
        <CardContent>
          {displayedJobs.length === 0 ? (
            <p className="text-center text-text-muted py-8">
              {jobs.length === 0 ? 'No jobs yet' : 'No matching jobs'}
            </p>
          ) : (
            <div className="space-y-2">
              {displayedJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        job.status === JobStatus.COMPLETED
                          ? 'success'
                          : job.status === JobStatus.FAILED
                          ? 'error'
                          : job.status === JobStatus.PROCESSING
                          ? 'warning'
                          : 'info'
                      }
                    >
                      {job.jurisdictionCode}
                    </Badge>
                    <div>
                      <p className="font-medium">{job.currentStep || 'Pending'}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {job.status === JobStatus.PROCESSING && (
                      <div className="w-32">
                        <ProgressBar value={job.progress} size="sm" />
                      </div>
                    )}
                    <Badge
                      variant={
                        job.status === JobStatus.COMPLETED
                          ? 'success'
                          : job.status === JobStatus.FAILED
                          ? 'error'
                          : job.status === JobStatus.PROCESSING
                          ? 'warning'
                          : 'default'
                      }
                    >
                      {JOB_STATUS_CONFIG[job.status]?.label || job.status}
                    </Badge>
                    {job.status === JobStatus.FAILED && (
                      <Button variant="ghost" size="sm" onClick={() => retryJob(job.id)}>
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Extraction pipeline steps for visualization
const EXTRACTION_STEPS = [
  { key: 'fetching', label: 'Fetch', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
  { key: 'parsing', label: 'Parse', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'extracting', label: 'Extract', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { key: 'analyzing', label: 'Analyze', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { key: 'saving', label: 'Save', icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4' },
];

function getStepIndex(currentStep?: string): number {
  if (!currentStep) return 0;
  const step = currentStep.toLowerCase();
  if (step.includes('fetch') || step.includes('download')) return 0;
  if (step.includes('pars')) return 1;
  if (step.includes('extract')) return 2;
  if (step.includes('analy') || step.includes('ai') || step.includes('process')) return 3;
  if (step.includes('sav') || step.includes('stor') || step.includes('complet')) return 4;
  return Math.floor((EXTRACTION_STEPS.length - 1) * (parseInt(currentStep) || 0) / 100);
}

interface JobCardProps {
  job: {
    id: string;
    jurisdictionCode: string;
    status: string;
    progress: number;
    currentStep?: string;
    agentConsensus?: number;
    createdAt?: Date | string;
  };
  onCancel: () => void;
}

function JobCard({ job, onCancel }: JobCardProps) {
  const currentStepIdx = getStepIndex(job.currentStep);

  return (
    <div className="p-4 border border-border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <div>
            <p className="font-semibold">{job.jurisdictionCode}</p>
            <p className="text-sm text-text-muted">{job.currentStep || 'Starting...'}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Step Pipeline */}
      <div className="flex items-center justify-between mb-4">
        {EXTRACTION_STEPS.map((step, idx) => {
          const isComplete = idx < currentStepIdx;
          const isCurrent = idx === currentStepIdx;
          const isPending = idx > currentStepIdx;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center transition-colors
                    ${isComplete ? 'bg-emerald-500' : isCurrent ? 'bg-amber-500 animate-pulse' : 'bg-surface-elevated'}
                  `}
                >
                  <svg
                    className={`w-4 h-4 ${isComplete ? 'text-white' : isCurrent ? 'text-black' : 'text-text-muted'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
                  </svg>
                </div>
                <span className={`text-xs mt-1 ${isCurrent ? 'text-amber-400' : 'text-text-muted'}`}>
                  {step.label}
                </span>
              </div>
              {idx < EXTRACTION_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${isComplete ? 'bg-emerald-500' : 'bg-surface-elevated'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <ProgressBar value={job.progress} showLabel />

      {job.agentConsensus !== undefined && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-text-muted">Agent Consensus:</span>
          <Badge variant={job.agentConsensus >= 80 ? 'success' : job.agentConsensus >= 60 ? 'warning' : 'error'}>
            {job.agentConsensus}%
          </Badge>
        </div>
      )}
    </div>
  );
}
