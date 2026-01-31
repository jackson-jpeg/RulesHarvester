// Core enums
export enum TriggerType {
  MOTION_FILED = 'MOTION_FILED',
  SERVICE_OF_PROCESS = 'SERVICE_OF_PROCESS',
  COMPLAINT_FILED = 'COMPLAINT_FILED',
  NOTICE_OF_APPEAL = 'NOTICE_OF_APPEAL',
  HEARING_SCHEDULED = 'HEARING_SCHEDULED',
  ORDER_ENTERED = 'ORDER_ENTERED',
  DISCOVERY_REQUEST = 'DISCOVERY_REQUEST',
  SUBPOENA_ISSUED = 'SUBPOENA_ISSUED',
  JUDGMENT_ENTERED = 'JUDGMENT_ENTERED',
  DEFAULT_ENTERED = 'DEFAULT_ENTERED',
}

export enum DeadlinePriority {
  STANDARD = 'STANDARD',
  URGENT = 'URGENT',
  FATAL = 'FATAL',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  VERIFYING = 'verifying',
  COMPLETED = 'completed',
  FAILED = 'failed',
  FLAGGED = 'flagged',
  DELTA_DETECTED = 'delta_detected',
  ANALYZING_DNA = 'analyzing_dna',
  RESOLVING_CONFLICTS = 'resolving_conflicts',
}

export enum JurisdictionStatus {
  IDLE = 'idle',
  SEARCHING = 'searching',
  HARVESTING = 'harvesting',
  SYNCED = 'synced',
  FAILED = 'failed',
  UPDATING = 'updating',
}

export enum SyncFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MANUAL_ONLY = 'MANUAL_ONLY',
}

export interface ScraperConfig {
  name: string;
  baseUrl: string;
  ruleListSelector: string;
  ruleLinkSelector: string;
  ruleContentSelector: string;
  ruleCodeSelector?: string;
  ruleTitleSelector?: string;
  paginationSelector?: string;
  rateLimitMs: number;
  discoveredAt?: string;
  confidence?: number;
  discoveryReasoning?: string;
}

export enum JurisdictionType {
  FEDERAL_CIRCUIT = 'federal_circuit',
  FEDERAL_DISTRICT = 'federal_district',
  STATE = 'state',
}

export enum AgentStatus {
  IDLE = 'idle',
  ANALYZING = 'analyzing',
  DEBATING = 'debating',
}

export enum ConflictStatus {
  UNRESOLVED = 'unresolved',
  RESOLVED = 'resolved',
  MANUAL_OVERRIDE = 'manual_override',
}

// Deadline interface
export interface Deadline {
  id: string;
  name: string;
  daysFromTrigger: number;
  priority: DeadlinePriority;
  actionRequired: string;
  calculationNotes?: string;
  exceptions?: string[];
}

// Jurisdiction DNA profile
export interface JurisdictionDNA {
  strictnessRating: number; // 1-10
  keyQuirks: string[];
  proTip: string;
  commonTraps: string[];
  historicalContext?: string;
}

// Tactical risk assessment
export interface TacticalRiskProfile {
  sanctionProbability: number; // 0-100
  administrativeFriction: number; // 1-10
  riskFactors: string[];
  mitigationStrategy: string;
}

// Multi-agent debate result
export interface AgentCritique {
  agentId: string;
  persona: 'Formalist' | 'Analyst' | 'Historian';
  position: string;
  reasoning: string;
  confidence: number;
}

export interface SwarmDebate {
  debateSummary: string;
  agentCritiques: AgentCritique[];
  consensusScore: number; // 0-100
  keyDisagreements?: string[];
}

// Rule conflicts
export interface RuleConflict {
  id: string;
  ruleAId: string;
  ruleBId: string;
  ruleACode: string;
  ruleBCode: string;
  discrepancy: string;
  aiResolutionRecommendation: string;
  status: ConflictStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// Audit logging
export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  user: string;
  hash: string;
  metadata?: Record<string, unknown>;
}

// Complete rule template
export interface RuleTemplate {
  id: string;
  ruleCode: string;
  name: string;
  jurisdictionId: string;
  triggerType: TriggerType;
  deadlines: Deadline[];
  relatedRules: string[];
  sourceUrl?: string;
  rawText?: string;
  dna?: JurisdictionDNA;
  riskProfile?: TacticalRiskProfile;
  swarmDebate?: SwarmDebate;
  conflicts?: RuleConflict[];
  auditHistory: AuditLog[];
  confidenceScore: number;
  extractionReasoning?: string;
  complexity?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Discovery candidate from crawling
export interface DiscoveryCandidate {
  id: string;
  ruleId: string;
  jurisdiction: string;
  jurisdictionId: string;
  snippet: string;
  sourceUrl: string;
  relevanceScore: number;
  status: 'discovered' | 'processing' | 'acquired' | 'rejected';
}

// Extraction job tracking
export interface ExtractionJob {
  id: string;
  jurisdictionId: string;
  jurisdictionCode: string;
  status: JobStatus;
  sourceUrl?: string;
  progress: number; // 0-100
  agentConsensus?: number;
  currentStep?: string;
  error?: string;
  ruleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Jurisdiction metadata
export interface JurisdictionMeta {
  id: string;
  code: string;
  name: string;
  type: JurisdictionType;
  status: JurisdictionStatus;
  ruleCount: number;
  dna?: JurisdictionDNA;
  parentId?: string; // For districts, reference to circuit
  courtWebsite?: string;
  lastSyncedAt?: Date;
  scraperConfig?: ScraperConfig;
  autoSyncEnabled?: boolean;
  syncFrequency?: SyncFrequency;
}

// AI Agent
export interface AIAgent {
  id: string;
  persona: 'Formalist' | 'Analyst' | 'Historian';
  status: AgentStatus;
  currentTask?: string;
}

// System log entry
export interface SystemLog {
  id: string;
  message: string;
  type: 'info' | 'warn' | 'success' | 'ai' | 'error';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// SSE event types
export interface SSEEvent {
  type: 'job_progress' | 'job_completed' | 'job_failed' | 'rule_updated' | 'conflict_detected';
  payload: unknown;
  timestamp: Date;
}

export interface JobProgressEvent extends SSEEvent {
  type: 'job_progress';
  payload: {
    jobId: string;
    progress: number;
    currentStep: string;
    agentConsensus?: number;
  };
}

export interface JobCompletedEvent extends SSEEvent {
  type: 'job_completed';
  payload: {
    jobId: string;
    ruleId: string;
    jurisdictionId: string;
  };
}

// Request/response DTOs
export interface CreateExtractionJobRequest {
  jurisdictionId: string;
  sourceUrl: string;
  rawText?: string;
}

export interface UpdateRuleRequest {
  name?: string;
  triggerType?: TriggerType;
  deadlines?: Deadline[];
  relatedRules?: string[];
  rawText?: string;
}

export interface DiscoverRulesRequest {
  jurisdictionId: string;
  searchQuery?: string;
}

// Dashboard stats
export interface DashboardStats {
  totalRules: number;
  totalJurisdictions: number;
  syncedJurisdictions: number;
  pendingJobs: number;
  unresolvedConflicts: number;
  avgConfidenceScore: number;
  recentExtractions: ExtractionJob[];
}

// Extraction result from Claude
export interface ExtractionResult {
  ruleCode: string;
  name: string;
  triggerType: TriggerType;
  deadlines: Deadline[];
  relatedRules: string[];
  confidenceScore: number;
  extractionReasoning: string;
}

// Deep scan result
export interface DeepScanResult {
  rawText: string;
  hash: string;
  sources: string[];
  title?: string;
}

// Authority reconciliation
export interface AuthorityReconciliation {
  conflicts: RuleConflict[];
  appellateWarnings: string[];
  authorityStatus: 'valid' | 'superseded' | 'contested';
}
