import { useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import { Spinner } from '../ui/Spinner';
import { useJobsStore } from '../../store/jobsStore';
import { JOB_STATUS_CONFIG } from '@rulesharvester/shared';

export function WorkflowView() {
  const { jobs, isLoading, fetchJobs, cancelJob, retryJob } = useJobsStore();

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const activeJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'processing');
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const failedJobs = jobs.filter((j) => j.status === 'failed');

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Extraction Workflow</h1>
          <p className="text-text-secondary">{jobs.length} total jobs</p>
        </div>
        <Button onClick={() => fetchJobs()} isLoading={isLoading}>
          Refresh
        </Button>
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
          <CardHeader>Active Extractions</CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <JobCard key={job.id} job={job} onCancel={() => cancelJob(job.id)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job History */}
      <Card>
        <CardHeader>Job History</CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-center text-text-muted py-8">No jobs yet</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        job.status === 'completed'
                          ? 'success'
                          : job.status === 'failed'
                          ? 'error'
                          : job.status === 'processing'
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
                    {job.status === 'processing' && (
                      <div className="w-32">
                        <ProgressBar value={job.progress} size="sm" />
                      </div>
                    )}
                    <Badge
                      variant={
                        job.status === 'completed'
                          ? 'success'
                          : job.status === 'failed'
                          ? 'error'
                          : job.status === 'processing'
                          ? 'warning'
                          : 'default'
                      }
                    >
                      {JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG]?.label || job.status}
                    </Badge>
                    {job.status === 'failed' && (
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

interface JobCardProps {
  job: {
    id: string;
    jurisdictionCode: string;
    status: string;
    progress: number;
    currentStep?: string;
    agentConsensus?: number;
  };
  onCancel: () => void;
}

function JobCard({ job, onCancel }: JobCardProps) {
  return (
    <div className="p-4 border border-border rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <div>
            <p className="font-semibold">{job.jurisdictionCode}</p>
            <p className="text-sm text-text-muted">{job.currentStep}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
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
