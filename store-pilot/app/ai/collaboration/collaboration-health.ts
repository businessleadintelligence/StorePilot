import type { CollaborationContext } from "./collaboration-types";

export function calculateCollaborationOverallHealth(context: CollaborationContext): number {
  const agentScores = context.agentResults
    .map((result) => result.healthScore)
    .filter((score): score is number => score != null);

  if (agentScores.length === 0) {
    return context.storeMetrics.storeHealth;
  }

  const averageAgentHealth =
    agentScores.reduce((total, score) => total + score, 0) / agentScores.length;

  return Math.round(averageAgentHealth * 0.6 + context.storeMetrics.storeHealth * 0.4);
}

export function calculateCollaborationConsensusScore(input: {
  actionCount: number;
  reinforcedCount: number;
  conflictCount: number;
  agentCount: number;
}): number {
  if (input.actionCount === 0) return 0;

  const reinforcementRatio = input.reinforcedCount / input.actionCount;
  const conflictPenalty = Math.min(0.35, input.conflictCount * 0.08);
  const coverageBoost = Math.min(0.25, input.agentCount * 0.04);
  const base = 0.45 + reinforcementRatio * 0.35 + coverageBoost - conflictPenalty;

  return Number(Math.max(0, Math.min(1, base)).toFixed(2));
}

export function buildCollaborationHealthWheel(context: CollaborationContext) {
  return context.agentResults.map((result) => ({
    label: result.agentId.replace(/_/g, " "),
    value: result.healthScore ?? context.storeMetrics.storeHealth,
  }));
}
