import { anthropic, defaultModelConfig, SYSTEM_PROMPTS, extractToolResult } from './client.js';
import type { JurisdictionDNA } from '@rulesharvester/shared';

const DNA_TOOL = {
  name: 'submit_dna_profile',
  description: 'Submit the jurisdiction DNA profile',
  input_schema: {
    type: 'object' as const,
    properties: {
      strictnessRating: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'How strict the jurisdiction is about procedural compliance (1-10)',
      },
      keyQuirks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Unusual or notable procedural requirements unique to this jurisdiction',
      },
      proTip: {
        type: 'string',
        description: 'Practical advice for practitioners in this jurisdiction',
      },
      commonTraps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Common mistakes that lead to sanctions or dismissals',
      },
      historicalContext: {
        type: 'string',
        description: 'Background about the jurisdiction\'s procedural evolution',
      },
    },
    required: ['strictnessRating', 'keyQuirks', 'proTip', 'commonTraps'],
  },
};

class DNAAnalysisService {
  async analyzeJurisdiction(
    jurisdictionName: string,
    sampleRules: string[]
  ): Promise<JurisdictionDNA> {
    const rulesContext =
      sampleRules.length > 0
        ? `\n\nSample rules from this jurisdiction:\n${sampleRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
        : '';

    const response = await anthropic.messages.create({
      ...defaultModelConfig,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.dnaAnalysis,
      messages: [
        {
          role: 'user',
          content: `Profile the procedural characteristics of: ${jurisdictionName}${rulesContext}`,
        },
      ],
      tools: [DNA_TOOL],
      tool_choice: { type: 'tool', name: 'submit_dna_profile' },
    });

    const result = extractToolResult<JurisdictionDNA>(response, 'submit_dna_profile');

    if (!result) {
      // Return default DNA if extraction fails
      return {
        strictnessRating: 5,
        keyQuirks: ['Unable to analyze jurisdiction characteristics'],
        proTip: 'Consult local counsel for jurisdiction-specific guidance',
        commonTraps: ['Unknown - perform additional research'],
      };
    }

    return result;
  }
}

export const dnaAnalysisService = new DNAAnalysisService();
