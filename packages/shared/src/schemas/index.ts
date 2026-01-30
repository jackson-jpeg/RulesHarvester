import { z } from 'zod';
import {
  TriggerType,
  DeadlinePriority,
  JobStatus,
  JurisdictionStatus,
  JurisdictionType,
  ConflictStatus,
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
  status: z.enum(['discovered', 'processing', 'acquired', 'rejected']),
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

// Pagination query schema
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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
