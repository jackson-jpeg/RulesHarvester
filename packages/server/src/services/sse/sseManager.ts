import type { Response } from 'express';
import type { SSEEvent, JobProgressEvent, JobCompletedEvent } from '@rulesharvester/shared';

class SSEManager {
  private clients: Map<string, Response> = new Map();
  private clientCounter = 0;

  addClient(res: Response): string {
    const clientId = `client-${++this.clientCounter}-${Date.now()}`;
    this.clients.set(clientId, res);
    console.log(`SSE client connected: ${clientId} (total: ${this.clients.size})`);
    return clientId;
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`SSE client disconnected: ${clientId} (total: ${this.clients.size})`);
  }

  broadcast(event: SSEEvent): void {
    const data = JSON.stringify(event);
    for (const [clientId, res] of this.clients) {
      try {
        res.write(`data: ${data}\n\n`);
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

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
