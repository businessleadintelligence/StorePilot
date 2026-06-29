import type { TrendEstimatedImpact } from "../schemas/trend-intelligence";

export function calculateTrendPriorityScore(input: {
  confidence: number;
  difficultyWeight: number;
  impact: TrendEstimatedImpact;
  momentum: number;
}): number {
  let score = input.confidence * 100 + input.momentum * 40;
  score += (input.impact.revenueOpportunity ?? 0) / 10;
  score += (input.impact.unitsProtected ?? 0) / 5;
  score *= input.difficultyWeight;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankTrendRecommendations<T extends { priorityScore: number; confidence: number }>(
  items: T[],
): T[] {
  return [...items].sort(
    (left, right) => right.priorityScore - left.priorityScore || right.confidence - left.confidence,
  );
}

export function deriveTrendOverallPriority(scores: number[]): number {
  const top = scores[0] ?? 0;
  if (top >= 85) return 1;
  if (top >= 70) return 2;
  if (top >= 50) return 3;
  return 4;
}

export function deriveTrendOverallConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  const total = confidences.reduce((sum, value) => sum + value, 0);
  return Math.round((total / confidences.length) * 100) / 100;
}
