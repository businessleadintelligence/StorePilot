export function calculateFocusScore(input: {
  topPriorityScores: number[];
  conflictScore: number;
  workloadScore: number;
  merchantCapacityScore: number;
  focusAreaCount: number;
}): {
  focusScore: number;
  focusAreas: string[];
  dispersionPenalty: number;
  issues: string[];
} {
  const issues: string[] = [];
  const top = input.topPriorityScores.slice(0, 3);
  const concentration =
    top.length === 0 ? 0 : top.reduce((sum, score) => sum + score, 0) / (top.length * 100);

  const dispersionPenalty = Math.max(0, input.focusAreaCount - 4) * 6;
  let focusScore = Math.round(
    concentration * 55 + input.merchantCapacityScore * 0.25 + input.workloadScore * 0.2 - dispersionPenalty,
  );
  focusScore -= Math.min(input.conflictScore, 100) * 0.12;
  focusScore = Math.max(0, Math.min(100, focusScore));

  const focusAreas: string[] = [];
  if (focusScore >= 70) focusAreas.push("high_priority_concentration");
  if (input.merchantCapacityScore < 45) focusAreas.push("capacity_constrained");
  if (input.conflictScore >= 40) focusAreas.push("conflict_distraction");
  if (input.workloadScore < 50) focusAreas.push("workload_overload");

  if (focusScore < 45) issues.push("focus_too_dispersed");

  return { focusScore, focusAreas, dispersionPenalty, issues };
}
