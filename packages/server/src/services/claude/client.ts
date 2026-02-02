import Anthropic from '@anthropic-ai/sdk';
import type { ZodSchema } from 'zod';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS } from '@rulesharvester/shared';

// Initialize Anthropic client with 2 minute timeout
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120000, // 2 minute timeout for long extractions
});

export const defaultModelConfig = {
  model: CLAUDE_MODEL,
  max_tokens: CLAUDE_MAX_TOKENS,
};

// System prompts for different AI tasks
export const SYSTEM_PROMPTS = {
  extraction: `You are a world-class computational law engineer specializing in procedural rule extraction. Your task is to analyze legal rule text and extract structured data about deadlines, triggers, and procedural requirements.

Be precise and thorough. Extract:
1. The rule code/number
2. The rule name/title
3. The trigger event type (what initiates the deadline)
4. All deadlines with their day counts, priority levels, and required actions
5. Related rules that are referenced or depend on this rule
6. Your confidence in the extraction (0-100)
7. Brief reasoning for your extraction decisions

For trigger types, use one of: MOTION_FILED, SERVICE_OF_PROCESS, COMPLAINT_FILED, NOTICE_OF_APPEAL, HEARING_SCHEDULED, ORDER_ENTERED, DISCOVERY_REQUEST, SUBPOENA_ISSUED, JUDGMENT_ENTERED, DEFAULT_ENTERED

For deadline priorities:
- STANDARD: Normal procedural deadlines
- URGENT: Time-sensitive deadlines requiring prompt action
- FATAL: Jurisdictional or statute-of-limitations deadlines that cannot be waived`,

  swarmDebate: `You are facilitating a legal analysis debate between three expert personas:

1. THE FORMALIST - Focuses on strict textual interpretation of rules, literal meanings, and procedural requirements as written.

2. THE ANALYST - Emphasizes practical implications, strategic considerations, and real-world application of rules.

3. THE HISTORIAN - Considers historical context, precedent evolution, and how rules have been interpreted over time.

Generate a structured debate where each persona provides their perspective on the rule, then synthesize a consensus with a confidence score. Identify key disagreements between the personas.`,

  dnaAnalysis: `You are a legal jurisdiction profiler. Analyze the jurisdiction's procedural characteristics based on available rules and court culture.

Provide:
1. Strictness rating (1-10, where 10 is most strict about procedural compliance)
2. Key quirks - unusual or notable procedural requirements
3. A pro tip - practical advice for practitioners in this jurisdiction
4. Common traps - mistakes that commonly lead to sanctions or dismissals
5. Historical context - any relevant background about the jurisdiction's procedural evolution`,

  riskProfile: `You are a legal risk analyst. Evaluate the tactical risk profile for compliance with a procedural rule.

Assess:
1. Sanction probability (0-100%) - likelihood of sanctions for non-compliance
2. Administrative friction (1-10) - how difficult is compliance
3. Risk factors - specific elements that increase risk
4. Mitigation strategy - recommended approach to minimize risk`,

  conflictResolution: `You are a legal authority expert. Compare two rules and identify any conflicts or inconsistencies.

For each conflict found, provide:
1. Description of the discrepancy
2. Analysis of which authority should prevail
3. Recommendation for resolution
4. Assessment of the conflict severity`,
};

// Helper to extract tool result from Claude response
export function extractToolResult<T>(
  response: Anthropic.Message,
  toolName: string
): T | null {
  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === toolName) {
      return block.input as T;
    }
  }
  return null;
}

// Helper to extract and validate tool result from Claude response
export function extractAndValidateToolResult<T>(
  response: Anthropic.Message,
  toolName: string,
  schema: ZodSchema<T>
): T | null {
  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === toolName) {
      const result = schema.safeParse(block.input);
      if (result.success) {
        return result.data;
      }
      console.error(
        `Claude tool "${toolName}" returned invalid data:`,
        result.error.issues
      );
      return null;
    }
  }
  return null;
}
