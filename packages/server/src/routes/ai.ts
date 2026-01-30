import { Router } from 'express';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';
import { extractionService } from '../services/claude/extractionService.js';
import { swarmDebateService } from '../services/claude/swarmDebateService.js';
import { dnaAnalysisService } from '../services/claude/dnaAnalysisService.js';
import { riskProfileService } from '../services/claude/riskProfileService.js';
import { conflictResolutionService } from '../services/claude/conflictResolutionService.js';

export const aiRouter = Router();

// Extract rule from text
aiRouter.post(
  '/extract',
  asyncHandler(async (req, res) => {
    const { text, jurisdictionId } = req.body;

    if (!text || !jurisdictionId) {
      throw new ValidationError('text and jurisdictionId are required');
    }

    const result = await extractionService.extractRule(text, jurisdictionId);

    res.json({ success: true, data: result });
  })
);

// Generate swarm debate for a rule
aiRouter.post(
  '/debate',
  asyncHandler(async (req, res) => {
    const { ruleText, ruleCode } = req.body;

    if (!ruleText) {
      throw new ValidationError('ruleText is required');
    }

    const result = await swarmDebateService.generateDebate(ruleText, ruleCode);

    res.json({ success: true, data: result });
  })
);

// Analyze jurisdiction DNA
aiRouter.post(
  '/dna',
  asyncHandler(async (req, res) => {
    const { jurisdictionName, sampleRules } = req.body;

    if (!jurisdictionName) {
      throw new ValidationError('jurisdictionName is required');
    }

    const result = await dnaAnalysisService.analyzeJurisdiction(
      jurisdictionName,
      sampleRules || []
    );

    res.json({ success: true, data: result });
  })
);

// Predict risk profile for a rule
aiRouter.post(
  '/risk',
  asyncHandler(async (req, res) => {
    const { rule, jurisdictionName } = req.body;

    if (!rule) {
      throw new ValidationError('rule is required');
    }

    const result = await riskProfileService.predictRisk(rule, jurisdictionName);

    res.json({ success: true, data: result });
  })
);

// Detect and resolve conflicts between rules
aiRouter.post(
  '/conflicts',
  asyncHandler(async (req, res) => {
    const { primaryRule, authorityRule } = req.body;

    if (!primaryRule || !authorityRule) {
      throw new ValidationError('primaryRule and authorityRule are required');
    }

    const result = await conflictResolutionService.detectConflicts(primaryRule, authorityRule);

    res.json({ success: true, data: result });
  })
);

// Assess rule complexity
aiRouter.post(
  '/complexity',
  asyncHandler(async (req, res) => {
    const { text } = req.body;

    if (!text) {
      throw new ValidationError('text is required');
    }

    const result = await extractionService.assessComplexity(text);

    res.json({ success: true, data: result });
  })
);
