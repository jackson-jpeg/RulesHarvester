import { anthropic, defaultModelConfig, SYSTEM_PROMPTS, extractToolResult } from './client.js';
import type { TacticalRiskProfile } from '@rulesharvester/shared';

const RISK_TOOL = {
  name: 'submit_risk_profile',
  description: 'Submit the tactical risk assessment',
  input_schema: {
    type: 'object' as const,
    properties: {
      sanctionProbability: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Probability of sanctions for non-compliance (0-100%)',
      },
      administrativeFriction: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'Difficulty of compliance (1=easy, 10=very difficult)',
      },
      riskFactors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific elements that increase risk',
      },
      mitigationStrategy: {
        type: 'string',
        description: 'Recommended approach to minimize risk',
      },
    },
    required: ['sanctionProbability', 'administrativeFriction', 'riskFactors', 'mitigationStrategy'],
  },
};

interface RuleInput {
  ruleCode: string;
  name: string;
  deadlines?: { name: string; daysFromTrigger: number; priority: string }[];
  rawText?: string;
}

class RiskProfileService {
  async predictRisk(rule: RuleInput, jurisdictionName?: string): Promise<TacticalRiskProfile> {
    const deadlineInfo =
      rule.deadlines?.map((d) => `- ${d.name}: ${d.daysFromTrigger} days (${d.priority})`).join('\n') || '';

    const context = `
Rule: ${rule.ruleCode} - ${rule.name}
${jurisdictionName ? `Jurisdiction: ${jurisdictionName}` : ''}
${deadlineInfo ? `\nDeadlines:\n${deadlineInfo}` : ''}
${rule.rawText ? `\nFull text:\n${rule.rawText}` : ''}
    `.trim();

    const response = await anthropic.messages.create({
      ...defaultModelConfig,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.riskProfile,
      messages: [
        {
          role: 'user',
          content: `Assess the tactical risk profile for compliance with:\n\n${context}`,
        },
      ],
      tools: [RISK_TOOL],
      tool_choice: { type: 'tool', name: 'submit_risk_profile' },
    });

    const result = extractToolResult<TacticalRiskProfile>(response, 'submit_risk_profile');

    if (!result) {
      return {
        sanctionProbability: 50,
        administrativeFriction: 5,
        riskFactors: ['Unable to assess risk factors'],
        mitigationStrategy: 'Consult with local counsel',
      };
    }

    return result;
  }
}

export const riskProfileService = new RiskProfileService();
