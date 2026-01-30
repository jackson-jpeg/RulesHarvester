import { anthropic, defaultModelConfig, SYSTEM_PROMPTS, extractToolResult } from './client.js';
import type { SwarmDebate, AgentCritique } from '@rulesharvester/shared';

const DEBATE_TOOL = {
  name: 'submit_debate',
  description: 'Submit the structured swarm debate analysis',
  input_schema: {
    type: 'object' as const,
    properties: {
      debateSummary: {
        type: 'string',
        description: 'Executive summary of the debate and key conclusions',
      },
      agentCritiques: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: 'Agent identifier',
            },
            persona: {
              type: 'string',
              enum: ['Formalist', 'Analyst', 'Historian'],
            },
            position: {
              type: 'string',
              description: 'The agent\'s main position on the rule',
            },
            reasoning: {
              type: 'string',
              description: 'Detailed reasoning for the position',
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Confidence in this analysis (0-100)',
            },
          },
          required: ['agentId', 'persona', 'position', 'reasoning', 'confidence'],
        },
        minItems: 3,
        maxItems: 3,
      },
      consensusScore: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Level of agreement between agents (0-100)',
      },
      keyDisagreements: {
        type: 'array',
        items: { type: 'string' },
        description: 'Main points of disagreement between agents',
      },
    },
    required: ['debateSummary', 'agentCritiques', 'consensusScore'],
  },
};

class SwarmDebateService {
  async generateDebate(ruleText: string, ruleCode?: string): Promise<SwarmDebate> {
    const response = await anthropic.messages.create({
      ...defaultModelConfig,
      max_tokens: 4096,
      system: SYSTEM_PROMPTS.swarmDebate,
      messages: [
        {
          role: 'user',
          content: `Analyze this procedural rule through the lens of three legal expert personas. ${ruleCode ? `Rule: ${ruleCode}` : ''}\n\n---\n\n${ruleText}`,
        },
      ],
      tools: [DEBATE_TOOL],
      tool_choice: { type: 'tool', name: 'submit_debate' },
    });

    const result = extractToolResult<{
      debateSummary: string;
      agentCritiques: AgentCritique[];
      consensusScore: number;
      keyDisagreements?: string[];
    }>(response, 'submit_debate');

    if (!result) {
      throw new Error('Failed to generate debate from Claude response');
    }

    return {
      debateSummary: result.debateSummary,
      agentCritiques: result.agentCritiques.map((c, i) => ({
        ...c,
        agentId: c.agentId || `agent-${i + 1}`,
      })),
      consensusScore: result.consensusScore,
      keyDisagreements: result.keyDisagreements,
    };
  }
}

export const swarmDebateService = new SwarmDebateService();
