export function analyzeMerchantCapacity(input: {
  openOperations: number;
  inProgressOperations: number;
  openRecommendations: number;
  openAutomations: number;
  averageCompletionMinutes: number;
  preferredBatchSize: number;
}): {
  merchantCapacityScore: number;
  availableSlots: number;
  overloadRisk: "low" | "medium" | "high";
  issues: string[];
} {
  const issues: string[] = [];
  const activeLoad = input.openOperations + input.inProgressOperations;
  const backlogLoad = input.openRecommendations + input.openAutomations;
  const capacityUnits = Math.max(1, input.preferredBatchSize);
  const loadRatio = (activeLoad + backlogLoad * 0.35) / capacityUnits;

  let merchantCapacityScore = Math.max(0, Math.min(100, Math.round(100 - loadRatio * 22)));
  merchantCapacityScore -= Math.min(input.inProgressOperations, 4) * 5;
  merchantCapacityScore += Math.max(0, 60 - input.averageCompletionMinutes) * 0.15;
  merchantCapacityScore = Math.max(0, Math.min(100, Math.round(merchantCapacityScore)));

  const availableSlots = Math.max(0, capacityUnits - activeLoad);
  const overloadRisk: "low" | "medium" | "high" =
    loadRatio >= 2.5 ? "high" : loadRatio >= 1.4 ? "medium" : "low";

  if (overloadRisk === "high") issues.push("merchant_capacity_overloaded");
  if (input.inProgressOperations >= capacityUnits) issues.push("execution_slots_full");

  return { merchantCapacityScore, availableSlots, overloadRisk, issues };
}

export function analyzeExecutionCapacity(input: {
  merchantCapacityScore: number;
  blockedOperationCount: number;
  automationReadyCount: number;
  teamOwnerCount: number;
}): {
  executionCapacityScore: number;
  parallelWorkstreams: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = input.merchantCapacityScore * 0.75;
  score += Math.min(input.automationReadyCount, 5) * 4;
  score -= Math.min(input.blockedOperationCount, 6) * 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const parallelWorkstreams = Math.max(
    1,
    Math.min(input.teamOwnerCount || 1, Math.floor(score / 30) + 1),
  );

  if (input.blockedOperationCount >= 3) issues.push("execution_blocked");
  if (score < 45) issues.push("execution_capacity_low");

  return { executionCapacityScore: score, parallelWorkstreams, issues };
}
