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
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  VERIFYING = 'VERIFYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  FLAGGED = 'FLAGGED',
  DELTA_DETECTED = 'DELTA_DETECTED',
  ANALYZING_DNA = 'ANALYZING_DNA',
  RESOLVING_CONFLICTS = 'RESOLVING_CONFLICTS',
}

export enum JurisdictionStatus {
  DISCOVERED = 'DISCOVERED', // Pending approval from Cartographer discovery
  IDLE = 'IDLE',
  AUTO_HARVESTING = 'AUTO_HARVESTING', // Auto-harvest in progress after approval
  SEARCHING = 'SEARCHING',
  HARVESTING = 'HARVESTING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
  UPDATING = 'UPDATING',
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
  FEDERAL_CIRCUIT = 'FEDERAL_CIRCUIT',
  FEDERAL_DISTRICT = 'FEDERAL_DISTRICT',
  STATE = 'STATE',
}

export enum AgentStatus {
  IDLE = 'idle',
  ANALYZING = 'analyzing',
  DEBATING = 'debating',
}

export enum ConflictStatus {
  UNRESOLVED = 'UNRESOLVED',
  RESOLVED = 'RESOLVED',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
}

// Log types for system logs
export enum LogType {
  INFO = 'INFO',
  WARN = 'WARN',
  SUCCESS = 'SUCCESS',
  AI = 'AI',
  ERROR = 'ERROR',
}

// Discovery candidate status
export enum DiscoveryStatus {
  DISCOVERED = 'DISCOVERED',
  PROCESSING = 'PROCESSING',
  ACQUIRED = 'ACQUIRED',
  REJECTED = 'REJECTED',
}

// Inbox item types for unified approval dashboard
export enum InboxItemType {
  JURISDICTION_APPROVAL = 'JURISDICTION_APPROVAL', // New jurisdiction from Cartographer
  RULE_VERIFICATION = 'RULE_VERIFICATION', // Rule needing human review (confidence < 90%)
  WATCHTOWER_CHANGE = 'WATCHTOWER_CHANGE', // Detected rule change from Watchtower
  SCRAPER_FAILURE = 'SCRAPER_FAILURE', // Scraper needs manual intervention
}

export enum InboxStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  DEFERRED = 'DEFERRED',
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
  status: DiscoveryStatus;
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
  // Discovery metadata (populated by Cartographer)
  discoverySource?: string;
  discoveryScore?: number;
  discoveryUrl?: string;
  discoveryQuery?: string;
  discoveredAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  // Scraper health tracking (for self-healing pipeline)
  consecutiveScrapeFailures?: number;
  lastScrapeError?: string;
  lastSuccessfulScrape?: Date;
  scraperConfigVersion?: number;
}

// Inbox item for unified approval dashboard
export interface InboxItem {
  id: string;
  type: InboxItemType;
  status: InboxStatus;
  title: string;
  description?: string;
  // Polymorphic reference (one of these will be set based on type)
  jurisdictionId?: string;
  ruleId?: string;
  conflictId?: string;
  // Metadata
  confidence?: number;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
  // Workflow
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: 'approved' | 'rejected' | 'deferred';
}

export interface InboxStats {
  total: number;
  pending: number;
  reviewed: number;
  deferred: number;
  byType: {
    [key in InboxItemType]: number;
  };
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
  type: LogType;
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
  type:
    | 'job_progress'
    | 'job_completed'
    | 'job_failed'
    | 'rule_created'
    | 'rule_updated'
    | 'conflict_detected'
    | 'watchtower_scan_started'
    | 'watchtower_scan_complete'
    | 'watchtower_change_detected'
    | 'cartographer_discovery_started'
    | 'cartographer_discovery_complete'
    | 'cartographer_discovery_failed'
    | 'cartographer_scheduled_run_started'
    | 'cartographer_scheduled_run_complete'
    | 'jurisdiction_approved'
    | 'auto_harvest_started'
    | 'auto_harvest_progress'
    | 'auto_harvest_complete'
    | 'auto_harvest_failed'
    | 'scraper_healing_started'
    | 'scraper_healing_complete'
    | 'scraper_healing_failed'
    | 'inbox_item_created'
    | 'inbox_item_updated';
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

// Cartographer types for jurisdiction discovery
export interface CartographerSearchResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
}

export interface CartographerDiscoveryResponse {
  isLegitimateCourtSite: boolean;
  jurisdictionType: JurisdictionType | null;
  suggestedName: string;
  suggestedCode: string;
  hasRulesSection: boolean;
  rulesPageUrl: string | null;
  confidence: number;
  reasoning: string;
}

export interface JurisdictionDiscoveryCandidate {
  id: string;
  name: string;
  code: string;
  type: JurisdictionType;
  courtWebsite: string;
  discoveryScore: number;
  discoveryUrl: string;
  discoveryQuery: string;
  discoverySource: string;
  discoveredAt: Date;
  hasRulesSection: boolean;
  rulesPageUrl?: string;
  reasoning: string;
}

export interface CartographerDiscoverRequest {
  jurisdictionTypes?: JurisdictionType[];
  maxResults?: number;
  customQueries?: string[];
}

export interface CartographerApprovalRequest {
  name?: string;
  code?: string;
  autoSyncEnabled?: boolean;
  syncFrequency?: SyncFrequency;
}

export interface CartographerStatus {
  isRunning: boolean;
  lastRunAt?: Date;
  totalDiscovered: number;
  pendingApproval: number;
  approvedToday: number;
}

// Export types
export interface ExportMetadata {
  exportVersion: string;
  exportedAt: string;
  format: 'json' | 'csv' | 'yaml';
  jurisdiction_count: number;
  node_count: number;
  integrity_hash: string;
  includeMetadata: boolean;
  includeRaw: boolean;
}

export interface ExportedRule {
  id: string;
  ruleCode: string;
  name: string;
  jurisdictionId: string;
  jurisdictionCode?: string;
  triggerType: TriggerType;
  deadlines: Deadline[];
  relatedRules: string[];
  confidenceScore: number;
  complexity?: number;
  sourceUrl?: string;
  rawText?: string;
  dna?: JurisdictionDNA;
  riskProfile?: TacticalRiskProfile;
  swarmDebate?: SwarmDebate;
  createdAt: string;
  updatedAt: string;
}

export interface ExportData {
  system_metadata: ExportMetadata;
  rules: ExportedRule[];
}
