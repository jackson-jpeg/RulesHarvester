import { z } from 'zod';
import {
  TriggerType,
  DeadlinePriority,
  JobStatus,
  JurisdictionStatus,
  JurisdictionType,
  ConflictStatus,
  DiscoveryStatus,
  LogType,
  SyncFrequency,
} from '../types/index.js';

// Deadline schema
export const DeadlineSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  daysFromTrigger: z.number().int(),
  priority: z.nativeEnum(DeadlinePriority),
  actionRequired: z.string().min(1),
  calculationNotes: z.string().optional(),
  exceptions: z.array(z.string()).optional(),
});

// Jurisdiction DNA schema
export const JurisdictionDNASchema = z.object({
  strictnessRating: z.number().min(1).max(10),
  keyQuirks: z.array(z.string()),
  proTip: z.string(),
  commonTraps: z.array(z.string()),
  historicalContext: z.string().optional(),
});

// Tactical risk profile schema
export const TacticalRiskProfileSchema = z.object({
  sanctionProbability: z.number().min(0).max(100),
  administrativeFriction: z.number().min(1).max(10),
  riskFactors: z.array(z.string()),
  mitigationStrategy: z.string(),
});

// Agent critique schema
export const AgentCritiqueSchema = z.object({
  agentId: z.string(),
  persona: z.enum(['Formalist', 'Analyst', 'Historian']),
  position: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(100),
});

// Swarm debate schema
export const SwarmDebateSchema = z.object({
  debateSummary: z.string(),
  agentCritiques: z.array(AgentCritiqueSchema),
  consensusScore: z.number().min(0).max(100),
  keyDisagreements: z.array(z.string()).optional(),
});

// Rule conflict schema
export const RuleConflictSchema = z.object({
  id: z.string(),
  ruleAId: z.string(),
  ruleBId: z.string(),
  ruleACode: z.string(),
  ruleBCode: z.string(),
  discrepancy: z.string(),
  aiResolutionRecommendation: z.string(),
  status: z.nativeEnum(ConflictStatus),
  resolvedAt: z.date().optional(),
  resolvedBy: z.string().optional(),
});

// Audit log schema
export const AuditLogSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  action: z.string(),
  user: z.string(),
  hash: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

// Rule template schema
export const RuleTemplateSchema = z.object({
  id: z.string(),
  ruleCode: z.string().min(1),
  name: z.string().min(1),
  jurisdictionId: z.string(),
  triggerType: z.nativeEnum(TriggerType),
  deadlines: z.array(DeadlineSchema),
  relatedRules: z.array(z.string()),
  sourceUrl: z.string().url().optional(),
  rawText: z.string().optional(),
  dna: JurisdictionDNASchema.optional(),
  riskProfile: TacticalRiskProfileSchema.optional(),
  swarmDebate: SwarmDebateSchema.optional(),
  conflicts: z.array(RuleConflictSchema).optional(),
  auditHistory: z.array(AuditLogSchema),
  confidenceScore: z.number().min(0).max(100),
  extractionReasoning: z.string().optional(),
  complexity: z.number().min(1).max(10).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Discovery candidate schema
export const DiscoveryCandidateSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  jurisdiction: z.string(),
  jurisdictionId: z.string(),
  snippet: z.string(),
  sourceUrl: z.string().url(),
  relevanceScore: z.number().min(0).max(100),
  status: z.nativeEnum(DiscoveryStatus),
});

// Extraction job schema
export const ExtractionJobSchema = z.object({
  id: z.string(),
  jurisdictionId: z.string(),
  jurisdictionCode: z.string(),
  status: z.nativeEnum(JobStatus),
  sourceUrl: z.string().url().optional(),
  progress: z.number().min(0).max(100),
  agentConsensus: z.number().min(0).max(100).optional(),
  currentStep: z.string().optional(),
  error: z.string().optional(),
  ruleId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Scraper config schema
export const ScraperConfigSchema = z.object({
  name: z.string(),
  baseUrl: z.string().url(),
  ruleListSelector: z.string(),
  ruleLinkSelector: z.string(),
  ruleContentSelector: z.string(),
  ruleCodeSelector: z.string().optional(),
  ruleTitleSelector: z.string().optional(),
  paginationSelector: z.string().optional(),
  rateLimitMs: z.number().int().min(0),
  discoveredAt: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  discoveryReasoning: z.string().optional(),
});

// Jurisdiction meta schema
export const JurisdictionMetaSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.nativeEnum(JurisdictionType),
  status: z.nativeEnum(JurisdictionStatus),
  ruleCount: z.number().int().min(0),
  dna: JurisdictionDNASchema.optional(),
  parentId: z.string().optional(),
  courtWebsite: z.string().url().optional(),
  lastSyncedAt: z.date().optional(),
  scraperConfig: ScraperConfigSchema.optional(),
  autoSyncEnabled: z.boolean().optional(),
  syncFrequency: z.nativeEnum(SyncFrequency).optional(),
});

// API request schemas
export const CreateExtractionJobRequestSchema = z.object({
  jurisdictionId: z.string().min(1),
  sourceUrl: z.string().url(),
  rawText: z.string().optional(),
});

export const UpdateRuleRequestSchema = z.object({
  name: z.string().min(1).optional(),
  triggerType: z.nativeEnum(TriggerType).optional(),
  deadlines: z.array(DeadlineSchema).optional(),
  relatedRules: z.array(z.string()).optional(),
  rawText: z.string().optional(),
});

export const DiscoverRulesRequestSchema = z.object({
  jurisdictionId: z.string().min(1),
  searchQuery: z.string().optional(),
});

// Claude extraction result schema (for tool output)
export const ExtractionResultSchema = z.object({
  ruleCode: z.string(),
  name: z.string(),
  triggerType: z.nativeEnum(TriggerType),
  deadlines: z.array(
    z.object({
      name: z.string(),
      daysFromTrigger: z.number(),
      priority: z.nativeEnum(DeadlinePriority),
      actionRequired: z.string(),
      calculationNotes: z.string().optional(),
      exceptions: z.array(z.string()).optional(),
    })
  ),
  relatedRules: z.array(z.string()),
  confidenceScore: z.number().min(0).max(100),
  extractionReasoning: z.string(),
});

// Scraper discovery response schema (from AI Cartographer tool)
export const ScraperDiscoveryResponseSchema = z.object({
  ruleListSelector: z.string(),
  ruleLinkSelector: z.string(),
  ruleContentSelector: z.string(),
  ruleCodeSelector: z.string().optional(),
  ruleTitleSelector: z.string().optional(),
  paginationSelector: z.string().optional(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

// Watchtower hash metadata schema
export const WatchtowerHashMetadataSchema = z.object({
  jurisdictionId: z.string().optional(),
  url: z.string().optional(),
  hash: z.string().optional(),
  checkedAt: z.string().optional(),
});

// Cartographer discovery response schema (from Claude court analysis tool)
export const CartographerDiscoveryResponseSchema = z.object({
  isLegitimateCourtSite: z.boolean(),
  jurisdictionType: z.nativeEnum(JurisdictionType).nullable(),
  suggestedName: z.string(),
  suggestedCode: z.string(),
  hasRulesSection: z.boolean(),
  rulesPageUrl: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

// Cartographer search result schema
export const CartographerSearchResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  domain: z.string(),
});

// Jurisdiction approval request schema
export const JurisdictionApprovalRequestSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  autoSyncEnabled: z.boolean().optional(),
  syncFrequency: z.nativeEnum(SyncFrequency).optional(),
});

// Jurisdiction rejection request schema
export const JurisdictionRejectionRequestSchema = z.object({
  reason: z.string().min(1),
});

// Cartographer discover request schema
export const CartographerDiscoverRequestSchema = z.object({
  jurisdictionTypes: z.array(z.nativeEnum(JurisdictionType)).optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
  customQueries: z.array(z.string()).optional(),
});

// Pagination query schema
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Sync settings request schema
export const SyncSettingsRequestSchema = z.object({
  autoSyncEnabled: z.boolean().optional(),
  syncFrequency: z.nativeEnum(SyncFrequency).optional(),
}).refine(
  (data) => data.autoSyncEnabled !== undefined || data.syncFrequency !== undefined,
  { message: 'At least one of autoSyncEnabled or syncFrequency is required' }
);

// Bulk extract request schema
export const BulkExtractRequestSchema = z.object({
  jurisdictionIds: z.array(z.string().min(1)).min(1).max(50),
  sourceUrl: z.string().url().optional(),
  rawText: z.string().optional(),
});

// Bulk rules update schema
export const BulkRulesUpdateSchema = z.object({
  ruleIds: z.array(z.string().min(1)).min(1).max(100),
  updates: z.object({
    triggerType: z.nativeEnum(TriggerType).optional(),
    confidenceScore: z.number().min(0).max(100).optional(),
    complexity: z.number().int().min(1).max(10).optional(),
  }).refine(
    (data) => Object.keys(data).some(k => data[k as keyof typeof data] !== undefined),
    { message: 'At least one update field is required' }
  ),
});

// Bulk status update schema
export const BulkStatusUpdateSchema = z.object({
  jurisdictionIds: z.array(z.string().min(1)).min(1),
  status: z.enum(['IDLE', 'SEARCHING', 'HARVESTING', 'SYNCED', 'FAILED', 'UPDATING']),
});

// Bulk delete rules schema
export const BulkDeleteRulesSchema = z.object({
  ruleIds: z.array(z.string().min(1)).min(1).max(100),
});

// Batch acquire request schema
export const BatchAcquireRequestSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1).max(100),
});

// Filter schemas
export const RuleFilterSchema = z.object({
  jurisdictionId: z.string().optional(),
  triggerType: z.nativeEnum(TriggerType).optional(),
  minConfidence: z.coerce.number().min(0).max(100).optional(),
  search: z.string().optional(),
});

export const JurisdictionFilterSchema = z.object({
  type: z.nativeEnum(JurisdictionType).optional(),
  status: z.nativeEnum(JurisdictionStatus).optional(),
  search: z.string().optional(),
});

// Type exports from schemas
export type DeadlineInput = z.infer<typeof DeadlineSchema>;
export type RuleTemplateInput = z.infer<typeof RuleTemplateSchema>;
export type ExtractionJobInput = z.infer<typeof ExtractionJobSchema>;
export type JurisdictionMetaInput = z.infer<typeof JurisdictionMetaSchema>;
export type CreateExtractionJobInput = z.infer<typeof CreateExtractionJobRequestSchema>;
export type UpdateRuleInput = z.infer<typeof UpdateRuleRequestSchema>;
export type DiscoverRulesInput = z.infer<typeof DiscoverRulesRequestSchema>;
export type ExtractionResultInput = z.infer<typeof ExtractionResultSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type RuleFilter = z.infer<typeof RuleFilterSchema>;
export type JurisdictionFilter = z.infer<typeof JurisdictionFilterSchema>;
export type ScraperDiscoveryResponse = z.infer<typeof ScraperDiscoveryResponseSchema>;
export type WatchtowerHashMetadata = z.infer<typeof WatchtowerHashMetadataSchema>;
export type ScraperConfigInput = z.infer<typeof ScraperConfigSchema>;
export type CartographerDiscoveryResponseInput = z.infer<typeof CartographerDiscoveryResponseSchema>;
export type CartographerSearchResultInput = z.infer<typeof CartographerSearchResultSchema>;
export type JurisdictionApprovalInput = z.infer<typeof JurisdictionApprovalRequestSchema>;
export type JurisdictionRejectionInput = z.infer<typeof JurisdictionRejectionRequestSchema>;
export type CartographerDiscoverInput = z.infer<typeof CartographerDiscoverRequestSchema>;
export type SyncSettingsRequest = z.infer<typeof SyncSettingsRequestSchema>;
export type BulkExtractRequest = z.infer<typeof BulkExtractRequestSchema>;
export type BulkRulesUpdate = z.infer<typeof BulkRulesUpdateSchema>;
export type BulkStatusUpdate = z.infer<typeof BulkStatusUpdateSchema>;
export type BulkDeleteRules = z.infer<typeof BulkDeleteRulesSchema>;
export type BatchAcquireRequest = z.infer<typeof BatchAcquireRequestSchema>;
