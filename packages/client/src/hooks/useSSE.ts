import { useEffect, useRef } from 'react';
import { useJobsStore } from '../store/jobsStore';
import { useRulesStore } from '../store/rulesStore';
import { useUIStore } from '../store/uiStore';

interface SSEEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const { updateJobProgress, completeJob, failJob } = useJobsStore();
  const { addRule } = useRulesStore();
  const { addLog } = useUIStore();

  useEffect(() => {
    // Create EventSource connection
    const eventSource = new EventSource('/api/events');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      addLog('Connected to server', 'success');
    };

    eventSource.onerror = () => {
      addLog('SSE connection error', 'error');
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            console.log('SSE connected:', data.payload.clientId);
            break;

          case 'job_progress': {
            const { jobId, progress, currentStep, agentConsensus } = data.payload as {
              jobId: string;
              progress: number;
              currentStep: string;
              agentConsensus?: number;
            };
            updateJobProgress(jobId, progress, currentStep, agentConsensus);
            break;
          }

          case 'job_completed': {
            const { jobId, ruleId, jurisdictionId } = data.payload as {
              jobId: string;
              ruleId: string;
              jurisdictionId: string;
            };
            completeJob(jobId, ruleId);
            addLog(`Rule extracted for ${jurisdictionId}`, 'success');
            break;
          }

          case 'job_failed': {
            const { jobId, error } = data.payload as {
              jobId: string;
              error: string;
            };
            failJob(jobId, error);
            addLog(`Extraction failed: ${error}`, 'error');
            break;
          }

          case 'rule_updated': {
            const { ruleId } = data.payload as { ruleId: string };
            addLog(`Rule ${ruleId} updated`, 'info');
            break;
          }

          case 'conflict_detected': {
            const { conflictId } = data.payload as { conflictId: string };
            addLog(`Conflict detected: ${conflictId}`, 'warn');
            break;
          }

          default:
            console.log('Unknown SSE event:', data.type);
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [updateJobProgress, completeJob, failJob, addRule, addLog]);

  return eventSourceRef.current;
}
