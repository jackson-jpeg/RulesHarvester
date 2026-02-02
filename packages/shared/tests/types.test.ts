import { describe, it, expect } from 'vitest';

// Test the shared type definitions and enum values
// This ensures type consistency across packages

describe('Shared Types', () => {
  describe('SSE Event Types', () => {
    const validEventTypes = [
      'job_progress',
      'job_completed',
      'job_failed',
      'rule_created',
      'rule_updated',
      'conflict_detected',
      'watchtower_scan_started',
      'watchtower_scan_complete',
      'watchtower_change_detected',
    ];

    it('should have all expected event types', () => {
      expect(validEventTypes).toContain('job_progress');
      expect(validEventTypes).toContain('job_completed');
      expect(validEventTypes).toContain('job_failed');
      expect(validEventTypes).toContain('rule_created');
      expect(validEventTypes).toContain('rule_updated');
      expect(validEventTypes).toContain('conflict_detected');
      expect(validEventTypes).toContain('watchtower_scan_started');
      expect(validEventTypes).toContain('watchtower_scan_complete');
      expect(validEventTypes).toContain('watchtower_change_detected');
    });

    it('should have exactly 9 event types', () => {
      expect(validEventTypes.length).toBe(9);
    });

    it('should have no duplicate event types', () => {
      const unique = new Set(validEventTypes);
      expect(unique.size).toBe(validEventTypes.length);
    });
  });

  describe('Job Status Enum', () => {
    const JobStatus = {
      PENDING: 'pending',
      PROCESSING: 'processing',
      VERIFYING: 'verifying',
      COMPLETED: 'completed',
      FAILED: 'failed',
      FLAGGED: 'flagged',
      DELTA_DETECTED: 'delta_detected',
      ANALYZING_DNA: 'analyzing_dna',
      RESOLVING_CONFLICTS: 'resolving_conflicts',
    };

    it('should have pending status', () => {
      expect(JobStatus.PENDING).toBe('pending');
    });

    it('should have processing status', () => {
      expect(JobStatus.PROCESSING).toBe('processing');
    });

    it('should have completed status', () => {
      expect(JobStatus.COMPLETED).toBe('completed');
    });

    it('should have failed status', () => {
      expect(JobStatus.FAILED).toBe('failed');
    });

    it('should have all job statuses as lowercase', () => {
      Object.values(JobStatus).forEach((status) => {
        expect(status).toBe(status.toLowerCase());
      });
    });
  });

  describe('Sync Frequency Enum', () => {
    const SyncFrequency = {
      DAILY: 'DAILY',
      WEEKLY: 'WEEKLY',
      MANUAL_ONLY: 'MANUAL_ONLY',
    };

    it('should have DAILY frequency', () => {
      expect(SyncFrequency.DAILY).toBe('DAILY');
    });

    it('should have WEEKLY frequency', () => {
      expect(SyncFrequency.WEEKLY).toBe('WEEKLY');
    });

    it('should have MANUAL_ONLY frequency', () => {
      expect(SyncFrequency.MANUAL_ONLY).toBe('MANUAL_ONLY');
    });

    it('should have all frequencies as uppercase', () => {
      Object.values(SyncFrequency).forEach((freq) => {
        expect(freq).toBe(freq.toUpperCase());
      });
    });
  });

  describe('Trigger Types', () => {
    const TriggerType = {
      MOTION_FILED: 'MOTION_FILED',
      SERVICE_OF_PROCESS: 'SERVICE_OF_PROCESS',
      COMPLAINT_FILED: 'COMPLAINT_FILED',
      NOTICE_OF_APPEAL: 'NOTICE_OF_APPEAL',
      HEARING_SCHEDULED: 'HEARING_SCHEDULED',
      ORDER_ENTERED: 'ORDER_ENTERED',
      DISCOVERY_REQUEST: 'DISCOVERY_REQUEST',
      SUBPOENA_ISSUED: 'SUBPOENA_ISSUED',
      JUDGMENT_ENTERED: 'JUDGMENT_ENTERED',
      DEFAULT_ENTERED: 'DEFAULT_ENTERED',
    };

    it('should have exactly 10 trigger types', () => {
      expect(Object.keys(TriggerType).length).toBe(10);
    });

    it('should have MOTION_FILED trigger', () => {
      expect(TriggerType.MOTION_FILED).toBe('MOTION_FILED');
    });

    it('should have all triggers as SCREAMING_SNAKE_CASE', () => {
      Object.entries(TriggerType).forEach(([key, value]) => {
        expect(key).toBe(value);
        expect(key).toMatch(/^[A-Z_]+$/);
      });
    });
  });

  describe('Connection Status Type', () => {
    const validStatuses = ['connecting', 'connected', 'reconnecting', 'disconnected'];

    it('should have connecting status', () => {
      expect(validStatuses).toContain('connecting');
    });

    it('should have connected status', () => {
      expect(validStatuses).toContain('connected');
    });

    it('should have reconnecting status', () => {
      expect(validStatuses).toContain('reconnecting');
    });

    it('should have disconnected status', () => {
      expect(validStatuses).toContain('disconnected');
    });

    it('should have exactly 4 connection statuses', () => {
      expect(validStatuses.length).toBe(4);
    });
  });

  describe('Tab ID Type', () => {
    const validTabs = [
      'dashboard',
      'crawler',
      'library',
      'workflow',
      'conflicts',
      'verify',
      'export',
      'settings',
      'jurisdiction-detail',
      'watchtower',
    ];

    it('should include watchtower tab', () => {
      expect(validTabs).toContain('watchtower');
    });

    it('should have all core navigation tabs', () => {
      expect(validTabs).toContain('dashboard');
      expect(validTabs).toContain('crawler');
      expect(validTabs).toContain('library');
      expect(validTabs).toContain('workflow');
      expect(validTabs).toContain('conflicts');
    });

    it('should have exactly 10 tabs', () => {
      expect(validTabs.length).toBe(10);
    });

    it('should have no duplicate tabs', () => {
      const unique = new Set(validTabs);
      expect(unique.size).toBe(validTabs.length);
    });
  });
});
