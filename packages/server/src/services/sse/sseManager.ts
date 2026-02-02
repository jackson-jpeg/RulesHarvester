import type { Response } from 'express';
import type { SSEEvent, JobProgressEvent, JobCompletedEvent } from '@rulesharvester/shared';

interface ClientInfo {
  response: Response;
  lastActivity: number;
}

class SSEManager {
  private clients: Map<string, ClientInfo> = new Map();
  private clientCounter = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly STALE_TIMEOUT_MS = 60000; // 60 seconds

  constructor() {
    // Start cleanup interval to remove stale clients
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleClients();
    }, 30000); // Check every 30 seconds
  }

  private cleanupStaleClients(): void {
    const now = Date.now();
    const staleClientIds: string[] = [];

    for (const [clientId, info] of this.clients) {
      if (now - info.lastActivity > this.STALE_TIMEOUT_MS) {
        staleClientIds.push(clientId);
      }
    }

    for (const clientId of staleClientIds) {
      console.log(`Removing stale SSE client: ${clientId}`);
      this.removeClient(clientId);
    }
  }

  addClient(res: Response): string {
    const clientId = `client-${++this.clientCounter}-${Date.now()}`;
    this.clients.set(clientId, {
      response: res,
      lastActivity: Date.now(),
    });
    console.log(`SSE client connected: ${clientId} (total: ${this.clients.size})`);
    return clientId;
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`SSE client disconnected: ${clientId} (total: ${this.clients.size})`);
  }

  updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  broadcast(event: SSEEvent): void {
    const data = JSON.stringify(event);
    for (const [clientId, info] of this.clients) {
      try {
        info.response.write(`data: ${data}\n\n`);
        info.lastActivity = Date.now();
      } catch (error) {
        console.error(`Failed to send to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  sendJobProgress(jobId: string, progress: number, currentStep: string, agentConsensus?: number): void {
    const event: JobProgressEvent = {
      type: 'job_progress',
      payload: { jobId, progress, currentStep, agentConsensus },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendJobCompleted(jobId: string, ruleId: string, jurisdictionId: string): void {
    const event: JobCompletedEvent = {
      type: 'job_completed',
      payload: { jobId, ruleId, jurisdictionId },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendJobFailed(jobId: string, error: string): void {
    const event: SSEEvent = {
      type: 'job_failed',
      payload: { jobId, error },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendRuleUpdated(ruleId: string, jurisdictionId: string): void {
    const event: SSEEvent = {
      type: 'rule_updated',
      payload: { ruleId, jurisdictionId },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendConflictDetected(conflictId: string, ruleAId: string, ruleBId: string): void {
    const event: SSEEvent = {
      type: 'conflict_detected',
      payload: { conflictId, ruleAId, ruleBId },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendWatchtowerScanStarted(frequency?: string): void {
    const event: SSEEvent = {
      type: 'watchtower_scan_started' as SSEEvent['type'],
      payload: { frequency: frequency || 'manual' },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendWatchtowerScanComplete(totalChecked: number, changesDetected: number, relevantChanges: number): void {
    const event: SSEEvent = {
      type: 'watchtower_scan_complete' as SSEEvent['type'],
      payload: { totalChecked, changesDetected, relevantChanges },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendWatchtowerChangeDetected(jurisdictionId: string, description?: string): void {
    const event: SSEEvent = {
      type: 'watchtower_change_detected' as SSEEvent['type'],
      payload: { jurisdictionId, description },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendCartographerDiscoveryStarted(): void {
    const event: SSEEvent = {
      type: 'cartographer_discovery_started' as SSEEvent['type'],
      payload: {},
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendCartographerDiscoveryComplete(discovered: number): void {
    const event: SSEEvent = {
      type: 'cartographer_discovery_complete' as SSEEvent['type'],
      payload: { discovered },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendCartographerDiscoveryFailed(error: string): void {
    const event: SSEEvent = {
      type: 'cartographer_discovery_failed' as SSEEvent['type'],
      payload: { error },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  sendJurisdictionApproved(jurisdictionId: string, name: string): void {
    const event: SSEEvent = {
      type: 'jurisdiction_approved' as SSEEvent['type'],
      payload: { jurisdictionId, name },
      timestamp: new Date(),
    };
    this.broadcast(event);
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
