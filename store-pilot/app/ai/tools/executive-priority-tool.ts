const DIFFICULTY_WEIGHT = {
  Easy: 1.1,
  Medium: 1,
  Hard: 0.85,
} as const;

export function deriveExecutiveDifficultyWeight(difficulty: string): number {
  if (difficulty === "Easy") return DIFFICULTY_WEIGHT.Easy;
  if (difficulty === "Hard") return DIFFICULTY_WEIGHT.Hard;
  return DIFFICULTY_WEIGHT.Medium;
}

export function calculateExecutivePriorityScore(input: {
  confidence: number;
  difficulty: string;
  revenueImpact: number;
  profitImpact: number;
  urgencySignals: number;
  blocked: boolean;
  dismissed: boolean;
  agentWeight: number;
}): number {
  let score = input.confidence * 100;
  score += input.revenueImpact * 0.35;
  score += input.profitImpact * 0.25;
  score += input.urgencySignals * 8;
  score *= deriveExecutiveDifficultyWeight(input.difficulty);
  score *= input.agentWeight;

  if (input.blocked) score -= 25;
  if (input.dismissed) score -= 18;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateBusinessUrgency(input: {
  blockedOperationCount: number;
  outOfStockProducts: number;
  revenueGrowthRate: number;
  criticalRiskCount: number;
  openHighPriorityCount: number;
}): number {
  let urgency = 20;
  urgency += Math.min(input.blockedOperationCount, 6) * 12;
  urgency += Math.min(input.outOfStockProducts, 10) * 4;
  urgency += Math.min(input.criticalRiskCount, 5) * 10;
  urgency += Math.min(input.openHighPriorityCount, 8) * 5;
  if (input.revenueGrowthRate < 0) urgency += 15;
  return Math.max(0, Math.min(100, Math.round(urgency)));
}

export function deriveExecutivePriorityLevel(priorityScore: number): number {
  if (priorityScore >= 85) return 1;
  if (priorityScore >= 70) return 2;
  if (priorityScore >= 50) return 3;
  if (priorityScore >= 35) return 4;
  return 5;
}
