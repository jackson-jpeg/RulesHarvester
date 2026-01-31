import { anthropic, defaultModelConfig, SYSTEM_PROMPTS, extractToolResult } from './client.js';
import { withRetry } from '../../utils/retry.js';
import type { RuleConflict, ConflictStatus } from '@rulesharvester/shared';

const CONFLICT_TOOL = {
  name: 'submit_conflicts',
  description: 'Submit detected conflicts between rules',
  input_schema: {
    type: 'object' as const,
    properties: {
      conflicts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            discrepancy: {
              type: 'string',
              description: 'Description of the conflict or inconsistency',
            },
            aiResolutionRecommendation: {
              type: 'string',
              description: 'Recommended resolution for the conflict',
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Severity of the conflict',
            },
          },
          required: ['discrepancy', 'aiResolutionRecommendation', 'severity'],
        },
      },
      appellateWarnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Warnings about appellate-level conflicts',
      },
      authorityStatus: {
        type: 'string',
        enum: ['valid', 'superseded', 'contested'],
        description: 'Status of the primary rule\'s authority',
      },
    },
    required: ['conflicts', 'authorityStatus'],
  },
};

interface RuleInput {
  id: string;
  ruleCode: string;
  name: string;
  rawText?: string;
}

class ConflictResolutionService {
  async detectConflicts(
    primaryRule: RuleInput,
    authorityRule: RuleInput
  ): Promise<{
    conflicts: RuleConflict[];
    appellateWarnings: string[];
    authorityStatus: 'valid' | 'superseded' | 'contested';
  }> {
    const response = await withRetry(() =>
      anthropic.messages.create({
        ...defaultModelConfig,
        max_tokens: 2048,
        system: SYSTEM_PROMPTS.conflictResolution,
        messages: [
          {
            role: 'user',
            content: `Compare these two rules and identify any conflicts:

PRIMARY RULE (${primaryRule.ruleCode}):
${primaryRule.name}
${primaryRule.rawText || '(No text available)'}

AUTHORITY RULE (${authorityRule.ruleCode}):
${authorityRule.name}
${authorityRule.rawText || '(No text available)'}`,
          },
        ],
        tools: [CONFLICT_TOOL],
        tool_choice: { type: 'tool', name: 'submit_conflicts' },
      })
    );

    const result = extractToolResult<{
      conflicts: Array<{
        discrepancy: string;
        aiResolutionRecommendation: string;
        severity: string;
      }>;
      appellateWarnings?: string[];
      authorityStatus: 'valid' | 'superseded' | 'contested';
    }>(response, 'submit_conflicts');

    if (!result) {
      return {
        conflicts: [],
        appellateWarnings: [],
        authorityStatus: 'valid',
      };
    }

    // Convert to RuleConflict format
    const conflicts: RuleConflict[] = result.conflicts.map((c, i) => ({
      id: `conflict-${Date.now()}-${i}`,
      ruleAId: primaryRule.id,
      ruleBId: authorityRule.id,
      ruleACode: primaryRule.ruleCode,
      ruleBCode: authorityRule.ruleCode,
      discrepancy: c.discrepancy,
      aiResolutionRecommendation: c.aiResolutionRecommendation,
      status: 'UNRESOLVED' as ConflictStatus,
    }));

    return {
      conflicts,
      appellateWarnings: result.appellateWarnings || [],
      authorityStatus: result.authorityStatus,
    };
  }
}

export const conflictResolutionService = new ConflictResolutionService();
