import type { GrowthEstimatedImpact } from "../schemas/growth-intelligence";

export function calculateGrowthPriorityScore(input: {
  confidence: number;
  difficultyWeight: number;
  impact: GrowthEstimatedImpact;
  sectionScore: number;
}): number {
  let score = input.confidence * 100 + (100 - input.sectionScore) * 0.5;
  score += (input.impact.revenueIncrease ?? 0) * 0.7;
  score += (input.impact.profitIncrease ?? 0) * 0.85;
  score += (input.impact.aovLift ?? 0) * 60;
  score += (input.impact.retentionLift ?? 0) * 50;
  score *= input.difficultyWeight;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function deriveGrowthDifficultyWeight(difficulty: string): number {
  if (difficulty === "Easy") return 1.1;
  if (difficulty === "Hard") return 0.85;
  return 1;
}

export function deriveGrowthRecommendationPriority(priorityScore: number): number {
  if (priorityScore >= 85) return 1;
  if (priorityScore >= 70) return 2;
  if (priorityScore >= 50) return 3;
  if (priorityScore >= 35) return 4;
  return 5;
}
