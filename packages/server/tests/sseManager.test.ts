import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Express Response type for testing
interface MockResponse {
  written: string[];
  write: (data: string) => void;
}

function createMockResponse(): MockResponse {
  const written: string[] = [];
  return {
    written,
    write: (data: string) => {
      written.push(data);
    },
  };
}

// SSE Manager implementation (extracted for testing)
class SSEManagerTest {
  private clients: Map<string, { response: MockResponse; lastActivity: number }> = new Map();
  private clientCounter = 0;

  addClient(res: MockResponse): string {
    const clientId = `client-${++this.clientCounter}-${Date.now()}`;
    this.clients.set(clientId, {
      response: res,
      lastActivity: Date.now(),
    });
    return clientId;
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  getClientCount(): number {
    return this.clients.size;
  }

  broadcast(event: { type: string; payload?: unknown; timestamp: Date }): void {
    const data = JSON.stringify(event);
    for (const [, info] of this.clients) {
      info.response.write(`data: ${data}\n\n`);
      info.lastActivity = Date.now();
    }
  }

  sendWatchtowerScanStarted(frequency?: string): void {
    this.broadcast({
      type: 'watchtower_scan_started',
      payload: { frequency: frequency || 'manual' },
      timestamp: new Date(),
    });
  }

  sendWatchtowerScanComplete(totalChecked: number, changesDetected: number, relevantChanges: number): void {
    this.broadcast({
      type: 'watchtower_scan_complete',
      payload: { totalChecked, changesDetected, relevantChanges },
      timestamp: new Date(),
    });
  }

  sendWatchtowerChangeDetected(jurisdictionId: string, description?: string): void {
    this.broadcast({
      type: 'watchtower_change_detected',
      payload: { jurisdictionId, description },
      timestamp: new Date(),
    });
  }

  sendJobProgress(jobId: string, progress: number, currentStep: string, agentConsensus?: number): void {
    this.broadcast({
      type: 'job_progress',
      payload: { jobId, progress, currentStep, agentConsensus },
      timestamp: new Date(),
    });
  }

  sendJobCompleted(jobId: string, ruleId: string, jurisdictionId: string): void {
    this.broadcast({
      type: 'job_completed',
      payload: { jobId, ruleId, jurisdictionId },
      timestamp: new Date(),
    });
  }

  sendJobFailed(jobId: string, error: string): void {
    this.broadcast({
      type: 'job_failed',
      payload: { jobId, error },
      timestamp: new Date(),
    });
  }

  sendConflictDetected(conflictId: string, ruleAId: string, ruleBId: string): void {
    this.broadcast({
      type: 'conflict_detected',
      payload: { conflictId, ruleAId, ruleBId },
      timestamp: new Date(),
    });
  }
}

describe('SSE Manager', () => {
  let manager: SSEManagerTest;

  beforeEach(() => {
    manager = new SSEManagerTest();
  });

  describe('Client Management', () => {
    it('should add clients and return unique IDs', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      const id1 = manager.addClient(res1);
      const id2 = manager.addClient(res2);

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^client-\d+-\d+$/);
      expect(manager.getClientCount()).toBe(2);
    });

    it('should remove clients', () => {
      const res = createMockResponse();
      const id = manager.addClient(res);

      expect(manager.getClientCount()).toBe(1);

      manager.removeClient(id);

      expect(manager.getClientCount()).toBe(0);
    });

    it('should handle removing non-existent client', () => {
      manager.removeClient('non-existent');

      expect(manager.getClientCount()).toBe(0);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all connected clients', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      manager.addClient(res1);
      manager.addClient(res2);

      manager.broadcast({ type: 'test', timestamp: new Date() });

      expect(res1.written.length).toBe(1);
      expect(res2.written.length).toBe(1);
      expect(res1.written[0]).toContain('data:');
    });

    it('should not broadcast to removed clients', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      const id1 = manager.addClient(res1);
      manager.addClient(res2);

      manager.removeClient(id1);

      manager.broadcast({ type: 'test', timestamp: new Date() });

      expect(res1.written.length).toBe(0);
      expect(res2.written.length).toBe(1);
    });

    it('should format SSE messages correctly', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.broadcast({ type: 'test', payload: { value: 42 }, timestamp: new Date() });

      expect(res.written[0]).toMatch(/^data: /);
      expect(res.written[0]).toMatch(/\n\n$/);

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.type).toBe('test');
      expect(parsed.payload.value).toBe(42);
    });
  });

  describe('Watchtower Events', () => {
    it('should send watchtower scan started event', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.sendWatchtowerScanStarted('DAILY');

      expect(res.written.length).toBe(1);

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.type).toBe('watchtower_scan_started');
      expect(parsed.payload.frequency).toBe('DAILY');
    });

    it('should default to manual frequency if not specified', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.sendWatchtowerScanStarted();

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.payload.frequency).toBe('manual');
    });

    it('should send watchtower scan complete event', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.sendWatchtowerScanComplete(10, 3, 1);

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.type).toBe('watchtower_scan_complete');
      expect(parsed.payload.totalChecked).toBe(10);
      expect(parsed.payload.changesDetected).toBe(3);
      expect(parsed.payload.relevantChanges).toBe(1);
    });

    it('should send watchtower change detected event', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.sendWatchtowerChangeDetected('jur-123', 'Filing deadline updated');

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.type).toBe('watchtower_change_detected');
      expect(parsed.payload.jurisdictionId).toBe('jur-123');
      expect(parsed.payload.description).toBe('Filing deadline updated');
    });

    it('should handle missing description in change detected', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.sendWatchtowerChangeDetected('jur-123');

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.payload.description).toBeUndefined();
    });
  });

  describe('Job Events', () => {
    it('should send job progress event', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.sendJobProgress('job-1', 50, 'Extracting', 85);

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.type).toBe('job_progress');
      expect(parsed.payload.jobId).toBe('job-1');
      expect(parsed.payload.progress).toBe(50);
      expect(parsed.payload.currentStep).toBe('Extracting');
      expect(parsed.payload.agentConsensus).toBe(85);
    });

    it('should send job completed event', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.sendJobCompleted('job-1', 'rule-1', 'jur-1');

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.type).toBe('job_completed');
      expect(parsed.payload.jobId).toBe('job-1');
      expect(parsed.payload.ruleId).toBe('rule-1');
      expect(parsed.payload.jurisdictionId).toBe('jur-1');
    });

    it('should send job failed event', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.sendJobFailed('job-1', 'Network error');

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.type).toBe('job_failed');
      expect(parsed.payload.jobId).toBe('job-1');
      expect(parsed.payload.error).toBe('Network error');
    });
  });

  describe('Conflict Events', () => {
    it('should send conflict detected event', () => {
      const res = createMockResponse();
      manager.addClient(res);

      manager.sendConflictDetected('conflict-1', 'rule-a', 'rule-b');

      const jsonPart = res.written[0].replace('data: ', '').replace('\n\n', '');
      const parsed = JSON.parse(jsonPart);

      expect(parsed.type).toBe('conflict_detected');
      expect(parsed.payload.conflictId).toBe('conflict-1');
      expect(parsed.payload.ruleAId).toBe('rule-a');
      expect(parsed.payload.ruleBId).toBe('rule-b');
    });
  });
});
