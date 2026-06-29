import type { StoreAuditEstimatedImpact } from "../schemas/store-audit-intelligence";

export function calculateAuditPriorityScore(input: {
  confidence: number;
  difficultyWeight: number;
  impact: StoreAuditEstimatedImpact;
  sectionScore: number;
}): number {
  let score = input.confidence * 100 + (100 - input.sectionScore) * 0.4;
  score += (input.impact.conversionLift ?? 0) * 40;
  score += (input.impact.seoLift ?? 0) * 30;
  score += (input.impact.performanceGain ?? 0) / 2;
  score *= input.difficultyWeight;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankAuditRecommendations<T extends { priorityScore: number; confidence: number }>(
  items: T[],
): T[] {
  return [...items].sort(
    (left, right) => right.priorityScore - left.priorityScore || right.confidence - left.confidence,
  );
}

export function deriveAuditOverallPriority(scores: number[]): number {
  const top = scores[0] ?? 0;
  if (top >= 85) return 1;
  if (top >= 70) return 2;
  if (top >= 50) return 3;
  return 4;
}

export function deriveAuditOverallConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  const total = confidences.reduce((sum, value) => sum + value, 0);
  return Math.round((total / confidences.length) * 100) / 100;
}
