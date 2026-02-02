import { useEffect, useRef, useCallback } from 'react';
import { useJobsStore } from '../store/jobsStore';
import { useRulesStore } from '../store/rulesStore';
import { useUIStore } from '../store/uiStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Reconnection config with exponential backoff
const INITIAL_RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_DELAY = 60000; // 60 seconds
const RECONNECT_MULTIPLIER = 2;

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const isUnmountedRef = useRef(false);

  const { updateJobProgress, completeJob, failJob, fetchJobs } = useJobsStore();
  const { addRule, fetchRules } = useRulesStore();
  const { addLog, setSSEConnectionStatus, incrementConflictCount, setConflictCount } = useUIStore();

  // Resync state after reconnection
  const resyncState = useCallback(async () => {
    try {
      await Promise.all([fetchJobs(), fetchRules()]);
      // Fetch conflict count
      const response = await fetch(`${API_BASE}/conflicts`);
      if (response.ok) {
        const data = await response.json();
        const unresolved = data.data?.items?.filter((c: { status: string }) => c.status === 'UNRESOLVED').length || 0;
        setConflictCount(unresolved);
      }
    } catch (error) {
      console.error('Failed to resync state after SSE reconnect:', error);
    }
  }, [fetchJobs, fetchRules, setConflictCount]);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setSSEConnectionStatus('connecting');

    const eventSource = new EventSource(`${API_BASE}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (isUnmountedRef.current) return;

      // Reset reconnect delay on successful connection
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      setSSEConnectionStatus('connected');
      addLog('Connected to server', 'success');

      // Resync state after reconnection to catch any missed events
      resyncState();
    };

    eventSource.onerror = () => {
      if (isUnmountedRef.current) return;

      eventSource.close();
      eventSourceRef.current = null;
      setSSEConnectionStatus('reconnecting');

      // Schedule reconnection with exponential backoff
      const delay = reconnectDelayRef.current;
      addLog(`Connection lost. Reconnecting in ${delay / 1000}s...`, 'warn');

      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          connect();
        }
      }, delay);

      // Increase delay for next attempt (with max cap)
      reconnectDelayRef.current = Math.min(
        reconnectDelayRef.current * RECONNECT_MULTIPLIER,
        MAX_RECONNECT_DELAY
      );
    };

    eventSource.onmessage = (event) => {
      if (isUnmountedRef.current) return;

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
              // Refresh rules to get the new rule data
              fetchRules();
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

          case 'rule_created': {
            const payload = data.payload as {
              rule: Parameters<typeof addRule>[0];
            } | undefined;
            if (payload?.rule) {
              addRule(payload.rule);
              addLog(`New rule created: ${payload.rule.ruleCode}`, 'success');
            }
            break;
          }

          case 'rule_updated': {
            const payload = data.payload as { ruleId: string; jurisdictionId: string } | undefined;
            if (payload?.ruleId) {
              addLog(`Rule ${payload.ruleId} updated`, 'info');
              // Refresh rules to get updated data
              fetchRules();
            }
            break;
          }

          case 'conflict_detected': {
            const payload = data.payload as { conflictId: string; ruleAId: string; ruleBId: string } | undefined;
            if (payload?.conflictId) {
              incrementConflictCount();
              addLog(`Conflict detected between rules`, 'warn');
            }
            break;
          }

          case 'watchtower_scan_started': {
            addLog('Watchtower scan started', 'info');
            break;
          }

          case 'watchtower_scan_complete': {
            const payload = data.payload as {
              totalChecked: number;
              changesDetected: number;
              relevantChanges: number;
            } | undefined;
            if (payload) {
              addLog(
                `Watchtower: ${payload.totalChecked} checked, ${payload.changesDetected} changes, ${payload.relevantChanges} relevant`,
                'info'
              );
            }
            break;
          }

          case 'watchtower_change_detected': {
            const payload = data.payload as {
              jurisdictionId: string;
              description?: string;
            } | undefined;
            if (payload) {
              addLog(
                `Watchtower: Change detected in ${payload.jurisdictionId}${payload.description ? `: ${payload.description}` : ''}`,
                'warn'
              );
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
  }, [updateJobProgress, completeJob, failJob, addRule, addLog, fetchRules, fetchJobs, setSSEConnectionStatus, incrementConflictCount, resyncState]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setSSEConnectionStatus('disconnected');
    };
  }, [connect, setSSEConnectionStatus]);

  return eventSourceRef.current;
}
