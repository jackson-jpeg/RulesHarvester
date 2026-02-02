import { useEffect, useRef } from 'react';
import { useJobsStore } from '../store/jobsStore';
import { useRulesStore } from '../store/rulesStore';
import { useUIStore } from '../store/uiStore';

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
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            // Server sends clientId directly, not in payload
            console.log('SSE connected:', data.clientId);
            break;

          case 'job_progress': {
            const payload = data.payload as {
              jobId: string;
              progress: number;
              currentStep: string;
              agentConsensus?: number;
            } | undefined;
            if (payload?.jobId) {
              updateJobProgress(payload.jobId, payload.progress, payload.currentStep, payload.agentConsensus);
            }
            break;
          }

          case 'job_completed': {
            const payload = data.payload as {
              jobId: string;
              ruleId: string;
              jurisdictionId: string;
            } | undefined;
            if (payload?.jobId) {
              completeJob(payload.jobId, payload.ruleId);
              addLog(`Rule extracted for ${payload.jurisdictionId}`, 'success');
            }
            break;
          }

          case 'job_failed': {
            const payload = data.payload as {
              jobId: string;
              error: string;
            } | undefined;
            if (payload?.jobId) {
              failJob(payload.jobId, payload.error);
              addLog(`Extraction failed: ${payload.error}`, 'error');
            }
            break;
          }

          case 'rule_updated': {
            const payload = data.payload as { ruleId: string } | undefined;
            if (payload?.ruleId) {
              addLog(`Rule ${payload.ruleId} updated`, 'info');
            }
            break;
          }

          case 'conflict_detected': {
            const payload = data.payload as { conflictId: string } | undefined;
            if (payload?.conflictId) {
              addLog(`Conflict detected: ${payload.conflictId}`, 'warn');
            }
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
