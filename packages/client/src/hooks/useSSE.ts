import { useEffect, useRef, useCallback } from 'react';
import { useJobsStore } from '../store/jobsStore';
import { useRulesStore } from '../store/rulesStore';
import { useUIStore } from '../store/uiStore';
import { LogType } from '@rulesharvester/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Reconnection config with exponential backoff
const INITIAL_RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_DELAY = 60000; // 60 seconds
const RECONNECT_MULTIPLIER = 2;

// Event deduplication config
const MAX_PROCESSED_EVENTS = 100;

// Maximum SSE message size (64KB) to prevent memory issues
const MAX_SSE_MESSAGE_SIZE = 64 * 1024;

/**
 * Circular buffer for efficient event deduplication
 * Maintains a fixed-size buffer with O(1) add and O(1) lookup
 */
interface CircularBuffer {
  keys: string[];
  set: Set<string>;
  index: number;
  capacity: number;
}

function createCircularBuffer(capacity: number): CircularBuffer {
  return {
    keys: new Array(capacity).fill(''),
    set: new Set(),
    index: 0,
    capacity,
  };
}

function addToCircularBuffer(buffer: CircularBuffer, key: string): void {
  // Remove the old key at current index from set
  const oldKey = buffer.keys[buffer.index];
  if (oldKey) {
    buffer.set.delete(oldKey);
  }

  // Add new key
  buffer.keys[buffer.index] = key;
  buffer.set.add(key);

  // Move to next slot (circular)
  buffer.index = (buffer.index + 1) % buffer.capacity;
}

function isInCircularBuffer(buffer: CircularBuffer, key: string): boolean {
  return buffer.set.has(key);
}

/**
 * Generate a unique event key for deduplication
 */
function generateEventKey(data: { type: string; payload?: unknown; timestamp?: unknown }): string {
  const payloadStr = data.payload ? JSON.stringify(data.payload) : '';
  const timestamp = data.timestamp || '';
  return `${data.type}:${payloadStr}:${timestamp}`;
}

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const isUnmountedRef = useRef(false);
  // Circular buffer for efficient event deduplication (O(1) operations, fixed memory)
  const processedEventsRef = useRef<CircularBuffer>(createCircularBuffer(MAX_PROCESSED_EVENTS));
  // AbortController for resync fetch operations
  const resyncAbortRef = useRef<AbortController | null>(null);

  const { updateJobProgress, completeJob, failJob, fetchJobs } = useJobsStore();
  const { addRule, fetchRules } = useRulesStore();
  const { addLog, setSSEConnectionStatus, incrementConflictCount, setConflictCount } = useUIStore();

  // Resync state after reconnection
  const resyncState = useCallback(async () => {
    // Cancel any existing resync operation
    if (resyncAbortRef.current) {
      resyncAbortRef.current.abort();
    }
    resyncAbortRef.current = new AbortController();
    const { signal } = resyncAbortRef.current;

    try {
      await Promise.all([fetchJobs(), fetchRules()]);

      // Check if aborted before making another request
      if (signal.aborted) return;

      // Fetch conflict count with abort support
      const response = await fetch(`${API_BASE}/conflicts`, { signal });
      if (response.ok) {
        const data = await response.json();
        const unresolved = data.data?.items?.filter((c: { status: string }) => c.status === 'UNRESOLVED').length || 0;
        setConflictCount(unresolved);
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
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
      addLog('Connected to server', LogType.SUCCESS);

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
      addLog(`Connection lost. Reconnecting in ${delay / 1000}s...`, LogType.WARN);

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
        // Validate message size to prevent memory issues from malicious/malformed data
        if (event.data.length > MAX_SSE_MESSAGE_SIZE) {
          console.warn(`SSE message too large (${event.data.length} bytes), skipping`);
          return;
        }

        const data = JSON.parse(event.data);

        // Skip 'connected' events from deduplication check
        if (data.type !== 'connected') {
          // Generate event key for deduplication
          const eventKey = generateEventKey(data);

          // Check if we've already processed this event (O(1) lookup)
          if (isInCircularBuffer(processedEventsRef.current, eventKey)) {
            return; // Skip duplicate event
          }

          // Track this event (O(1) add with automatic old entry removal)
          addToCircularBuffer(processedEventsRef.current, eventKey);
        }

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
              addLog(`Rule extracted for ${payload.jurisdictionId}`, LogType.SUCCESS);
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
              addLog(`Extraction failed: ${payload.error}`, LogType.ERROR);
            }
            break;
          }

          case 'rule_created': {
            const payload = data.payload as {
              rule: Parameters<typeof addRule>[0];
            } | undefined;
            if (payload?.rule) {
              addRule(payload.rule);
              addLog(`New rule created: ${payload.rule.ruleCode}`, LogType.SUCCESS);
            }
            break;
          }

          case 'rule_updated': {
            const payload = data.payload as { ruleId: string; jurisdictionId: string } | undefined;
            if (payload?.ruleId) {
              addLog(`Rule ${payload.ruleId} updated`, LogType.INFO);
              // Refresh rules to get updated data
              fetchRules();
            }
            break;
          }

          case 'conflict_detected': {
            const payload = data.payload as { conflictId: string; ruleAId: string; ruleBId: string } | undefined;
            if (payload?.conflictId) {
              incrementConflictCount();
              addLog(`Conflict detected between rules`, LogType.WARN);
            }
            break;
          }

          case 'watchtower_scan_started': {
            addLog('Watchtower scan started', LogType.INFO);
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
                LogType.INFO
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
                LogType.WARN
              );
            }
            break;
          }

          case 'cartographer_discovery_started': {
            addLog('Cartographer: Discovery started', LogType.INFO);
            break;
          }

          case 'cartographer_discovery_complete': {
            const payload = data.payload as { discovered: number } | undefined;
            if (payload) {
              addLog(
                `Cartographer: Discovery complete - ${payload.discovered} new jurisdictions found`,
                LogType.SUCCESS
              );
            }
            break;
          }

          case 'cartographer_discovery_failed': {
            const payload = data.payload as { error: string } | undefined;
            if (payload) {
              addLog(`Cartographer: Discovery failed - ${payload.error}`, LogType.ERROR);
            }
            break;
          }

          case 'jurisdiction_approved': {
            const payload = data.payload as {
              jurisdictionId: string;
              name: string;
            } | undefined;
            if (payload) {
              addLog(`Jurisdiction approved: ${payload.name}`, LogType.SUCCESS);
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

      // Abort any pending resync operations
      if (resyncAbortRef.current) {
        resyncAbortRef.current.abort();
        resyncAbortRef.current = null;
      }

      setSSEConnectionStatus('disconnected');
    };
  }, [connect, setSSEConnectionStatus]);

  return eventSourceRef.current;
}
