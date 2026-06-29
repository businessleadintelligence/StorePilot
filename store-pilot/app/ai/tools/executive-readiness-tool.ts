export function calculateGrowthMomentum(input: {
  revenueGrowthRate: number;
  businessHealthScore: number | null;
  implementedGrowthActions: number;
  campaignReadinessProxy: number;
}): number {
  const growthBase = input.businessHealthScore ?? 50;
  const revenueComponent = Math.max(0, Math.min(100, 50 + input.revenueGrowthRate * 0.5));
  const executionComponent = Math.min(100, input.implementedGrowthActions * 8);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        growthBase * 0.4 + revenueComponent * 0.35 + executionComponent * 0.15 + input.campaignReadinessProxy * 0.1,
      ),
    ),
  );
}

export function calculateExecutionReadiness(input: {
  merchantCapacityScore: number;
  executionCapacityScore: number;
  blockedOperationCount: number;
  criticalBlockerCount: number;
  executionRiskScore: number;
}): {
  executionReadiness: number;
  readinessBand: "ready" | "cautious" | "not_ready";
  issues: string[];
} {
  const issues: string[] = [];
  let score =
    input.merchantCapacityScore * 0.35 +
    input.executionCapacityScore * 0.35 +
    Math.max(0, 100 - input.executionRiskScore) * 0.3;
  score -= Math.min(input.blockedOperationCount, 6) * 6;
  score -= Math.min(input.criticalBlockerCount, 4) * 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const readinessBand: "ready" | "cautious" | "not_ready" =
    score >= 70 ? "ready" : score >= 45 ? "cautious" : "not_ready";

  if (readinessBand === "not_ready") issues.push("execution_not_ready");

  return { executionReadiness: score, readinessBand, issues };
}

export function calculateAutomationReadiness(input: {
  automationReadyCount: number;
  activeAutomations: number;
  verifiedOperationCount: number;
  executionReadiness: number;
  repeatableOperationCount: number;
}): {
  automationReadiness: number;
  automatableCandidates: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = input.executionReadiness * 0.45;
  score += Math.min(input.automationReadyCount, 6) * 8;
  score += Math.min(input.verifiedOperationCount, 8) * 4;
  score += Math.min(input.repeatableOperationCount, 5) * 5;
  score -= Math.min(input.activeAutomations, 4) * 3;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const automatableCandidates = Math.max(
    0,
    input.repeatableOperationCount + input.automationReadyCount - input.activeAutomations,
  );

  if (score < 40) issues.push("automation_not_ready");

  return { automationReadiness: score, automatableCandidates, issues };
}
