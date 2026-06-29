export function analyzeGrowthCapacity(input: {
  activeProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  openGrowthRecommendations: number;
  implementedRecommendationCount: number;
}): { capacityScore: number; blockedInitiatives: number; issues: string[] } {
  const issues: string[] = [];
  const stockPressure =
    input.activeProducts <= 0
      ? 0
      : Math.round(((input.outOfStockProducts + input.lowStockProducts) / input.activeProducts) * 100);
  const executionLoad = Math.min(100, input.openGrowthRecommendations * 8);
  const executionMomentum = Math.min(100, input.implementedRecommendationCount * 6);
  const capacityScore = Math.max(
    0,
    Math.min(100, Math.round(100 - stockPressure * 0.45 - executionLoad * 0.25 + executionMomentum * 0.15)),
  );
  const blockedInitiatives =
    (input.outOfStockProducts >= 3 ? 1 : 0) +
    (input.openGrowthRecommendations >= 8 ? 1 : 0) +
    (stockPressure >= 35 ? 1 : 0);

  if (stockPressure >= 35) issues.push("inventory_capacity_limits_growth");
  if (input.openGrowthRecommendations >= 10) issues.push("execution_backlog_high");

  return { capacityScore, blockedInitiatives, issues };
}
