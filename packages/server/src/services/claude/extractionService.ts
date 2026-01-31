import { anthropic, defaultModelConfig, SYSTEM_PROMPTS, extractToolResult } from './client.js';
import { withRetry } from '../../utils/retry.js';
import type { ExtractionResult, TriggerType, DeadlinePriority } from '@rulesharvester/shared';

const EXTRACTION_TOOL = {
  name: 'submit_extraction',
  description: 'Submit the extracted rule data in structured format',
  input_schema: {
    type: 'object' as const,
    properties: {
      ruleCode: {
        type: 'string',
        description: 'The rule code or number (e.g., "Rule 12(b)", "FRCP 56")',
      },
      name: {
        type: 'string',
        description: 'The name or title of the rule',
      },
      triggerType: {
        type: 'string',
        enum: [
          'MOTION_FILED',
          'SERVICE_OF_PROCESS',
          'COMPLAINT_FILED',
          'NOTICE_OF_APPEAL',
          'HEARING_SCHEDULED',
          'ORDER_ENTERED',
          'DISCOVERY_REQUEST',
          'SUBPOENA_ISSUED',
          'JUDGMENT_ENTERED',
          'DEFAULT_ENTERED',
        ],
        description: 'The event that triggers the deadline',
      },
      deadlines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the deadline' },
            daysFromTrigger: {
              type: 'number',
              description: 'Number of days from trigger event',
            },
            priority: {
              type: 'string',
              enum: ['STANDARD', 'URGENT', 'FATAL'],
            },
            actionRequired: {
              type: 'string',
              description: 'What action must be taken',
            },
            calculationNotes: {
              type: 'string',
              description: 'Notes on how the deadline is calculated',
            },
            exceptions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Exceptions to the deadline',
            },
          },
          required: ['name', 'daysFromTrigger', 'priority', 'actionRequired'],
        },
      },
      relatedRules: {
        type: 'array',
        items: { type: 'string' },
        description: 'Related rule codes that are referenced',
      },
      confidenceScore: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Confidence in the extraction accuracy (0-100)',
      },
      extractionReasoning: {
        type: 'string',
        description: 'Brief explanation of extraction decisions',
      },
    },
    required: [
      'ruleCode',
      'name',
      'triggerType',
      'deadlines',
      'relatedRules',
      'confidenceScore',
      'extractionReasoning',
    ],
  },
};

const COMPLEXITY_TOOL = {
  name: 'submit_complexity',
  description: 'Submit the complexity assessment',
  input_schema: {
    type: 'object' as const,
    properties: {
      score: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'Complexity score from 1 (simple) to 10 (very complex)',
      },
      rationale: {
        type: 'string',
        description: 'Brief explanation of the complexity assessment',
      },
    },
    required: ['score', 'rationale'],
  },
};

class ExtractionService {
  async extractRule(ruleText: string, jurisdictionId: string): Promise<ExtractionResult> {
    const response = await withRetry(() =>
      anthropic.messages.create({
        ...defaultModelConfig,
        system: SYSTEM_PROMPTS.extraction,
        messages: [
          {
            role: 'user',
            content: `Extract structured data from this legal rule text. The rule is from jurisdiction: ${jurisdictionId}\n\n---\n\n${ruleText}`,
          },
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'submit_extraction' },
      })
    );

    const result = extractToolResult<ExtractionResult>(response, 'submit_extraction');

    if (!result) {
      throw new Error('Failed to extract rule data from Claude response');
    }

    // Add IDs to deadlines
    const deadlinesWithIds = result.deadlines.map((d, i) => ({
      ...d,
      id: `deadline-${Date.now()}-${i}`,
      priority: d.priority as DeadlinePriority,
    }));

    return {
      ...result,
      triggerType: result.triggerType as TriggerType,
      deadlines: deadlinesWithIds,
    };
  }

  async assessComplexity(text: string): Promise<{ score: number; rationale: string }> {
    const response = await withRetry(() =>
      anthropic.messages.create({
        ...defaultModelConfig,
        max_tokens: 1024,
        system: `You are a legal complexity analyst. Rate the procedural complexity of rules on a scale of 1-10.

Consider:
- Number of conditions and exceptions
- Calculation complexity for deadlines
- Cross-references to other rules
- Ambiguity in language
- Practical difficulty of compliance`,
        messages: [
          {
            role: 'user',
            content: `Assess the complexity of this legal rule text:\n\n${text}`,
          },
        ],
        tools: [COMPLEXITY_TOOL],
        tool_choice: { type: 'tool', name: 'submit_complexity' },
      })
    );

    const result = extractToolResult<{ score: number; rationale: string }>(
      response,
      'submit_complexity'
    );

    if (!result) {
      return { score: 5, rationale: 'Unable to assess complexity' };
    }

    return result;
  }
}

export const extractionService = new ExtractionService();
