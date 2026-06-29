import { difficultyWeight } from "./collaboration-utils";

export function calculateExecutivePriorityScore(input: {
  priority: number;
  confidence: number;
  revenueImpact: number;
  risk: "low" | "medium" | "high";
  reinforced: boolean;
  agentCount: number;
  difficulty: string;
}): number {
  const riskWeight = input.risk === "high" ? 30 : input.risk === "medium" ? 18 : 8;
  const reinforcementBoost = input.reinforced ? 12 : 0;
  const consensusBoost = Math.min(15, input.agentCount * 4);
  const revenueBoost = Math.min(25, input.revenueImpact / 1000);
  const urgencyBoost = (6 - input.priority) * 8;
  const confidenceBoost = input.confidence * 20;
  const difficultyPenalty = difficultyWeight(input.difficulty) * 3;

  return Number(
    (
      riskWeight +
      reinforcementBoost +
      consensusBoost +
      revenueBoost +
      urgencyBoost +
      confidenceBoost -
      difficultyPenalty
    ).toFixed(2),
  );
}

export function deriveOverallPriority(actions: Array<{ priority: number; priorityScore?: number }>): number {
  if (actions.length === 0) return 3;
  const sorted = [...actions].sort(
    (left, right) =>
      left.priority - right.priority || (right.priorityScore ?? 0) - (left.priorityScore ?? 0),
  );
  return sorted[0]?.priority ?? 3;
}
