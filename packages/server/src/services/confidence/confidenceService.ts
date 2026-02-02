import { CONFIDENCE_THRESHOLDS } from '@rulesharvester/shared';
import { logger } from '../../utils/logger.js';

export type ConfidenceDecision = 'auto_approve' | 'manual_review' | 'auto_reject';

export interface ConfidenceEvaluationResult {
  decision: ConfidenceDecision;
  confidence: number;
  reason: string;
}

class ConfidenceService {
  /**
   * Evaluate confidence and determine routing decision
   */
  evaluateAndRoute(
    itemType: string,
    confidence: number
  ): ConfidenceEvaluationResult {
    if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
      logger.debug(
        `Confidence: ${itemType} auto-approved (${confidence}% >= ${CONFIDENCE_THRESHOLDS.AUTO_APPROVE}%)`
      );
      return {
        decision: 'auto_approve',
        confidence,
        reason: `High confidence (${confidence}%) - automatically approved`,
      };
    }

    if (confidence >= CONFIDENCE_THRESHOLDS.MANUAL_REVIEW) {
      logger.debug(
        `Confidence: ${itemType} needs review (${confidence}% between ${CONFIDENCE_THRESHOLDS.MANUAL_REVIEW}%-${CONFIDENCE_THRESHOLDS.AUTO_APPROVE}%)`
      );
      return {
        decision: 'manual_review',
        confidence,
        reason: `Medium confidence (${confidence}%) - requires manual review`,
      };
    }

    logger.debug(
      `Confidence: ${itemType} auto-rejected (${confidence}% < ${CONFIDENCE_THRESHOLDS.MANUAL_REVIEW}%)`
    );
    return {
      decision: 'auto_reject',
      confidence,
      reason: `Low confidence (${confidence}%) - flagged for rejection or deep review`,
    };
  }

  /**
   * Check if confidence meets auto-approve threshold
   */
  isAutoApprovable(confidence: number): boolean {
    return confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE;
  }

  /**
   * Check if confidence needs manual review
   */
  needsManualReview(confidence: number): boolean {
    return (
      confidence >= CONFIDENCE_THRESHOLDS.MANUAL_REVIEW &&
      confidence < CONFIDENCE_THRESHOLDS.AUTO_APPROVE
    );
  }

  /**
   * Check if confidence is too low (should be rejected or flagged)
   */
  isTooLow(confidence: number): boolean {
    return confidence < CONFIDENCE_THRESHOLDS.MANUAL_REVIEW;
  }

  /**
   * Get the current threshold configuration
   */
  getThresholds(): typeof CONFIDENCE_THRESHOLDS {
    return { ...CONFIDENCE_THRESHOLDS };
  }

  /**
   * Calculate a combined confidence score from multiple factors
   */
  calculateCombinedConfidence(factors: {
    extractionConfidence?: number;
    selectorMatchScore?: number;
    sourceReliability?: number;
    contentQuality?: number;
  }): number {
    const weights = {
      extractionConfidence: 0.4,
      selectorMatchScore: 0.2,
      sourceReliability: 0.25,
      contentQuality: 0.15,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    if (factors.extractionConfidence !== undefined) {
      weightedSum += factors.extractionConfidence * weights.extractionConfidence;
      totalWeight += weights.extractionConfidence;
    }

    if (factors.selectorMatchScore !== undefined) {
      weightedSum += factors.selectorMatchScore * weights.selectorMatchScore;
      totalWeight += weights.selectorMatchScore;
    }

    if (factors.sourceReliability !== undefined) {
      weightedSum += factors.sourceReliability * weights.sourceReliability;
      totalWeight += weights.sourceReliability;
    }

    if (factors.contentQuality !== undefined) {
      weightedSum += factors.contentQuality * weights.contentQuality;
      totalWeight += weights.contentQuality;
    }

    if (totalWeight === 0) {
      return 0;
    }

    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }

  /**
   * Get human-readable confidence level
   */
  getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
      return 'high';
    }
    if (confidence >= CONFIDENCE_THRESHOLDS.MANUAL_REVIEW) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get confidence badge color for UI display
   */
  getConfidenceColor(
    confidence: number
  ): 'emerald' | 'amber' | 'rose' {
    if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
      return 'emerald';
    }
    if (confidence >= CONFIDENCE_THRESHOLDS.MANUAL_REVIEW) {
      return 'amber';
    }
    return 'rose';
  }
}

export const confidenceService = new ConfidenceService();
