export function calculateOpportunityCost(input: {
  deferredRevenueImpact: number;
  deferredProfitImpact: number;
  blockedOperationCount: number;
  conflictCount: number;
  daysDelayed: number;
}): {
  opportunityCostScore: number;
  estimatedRevenueCost: number;
  estimatedProfitCost: number;
  issues: string[];
} {
  const issues: string[] = [];
  const delayMultiplier = 1 + Math.min(input.daysDelayed, 14) * 0.04;
  const estimatedRevenueCost = Math.round(
    (input.deferredRevenueImpact + input.blockedOperationCount * 120) * delayMultiplier,
  );
  const estimatedProfitCost = Math.round(
    (input.deferredProfitImpact + input.conflictCount * 85) * delayMultiplier,
  );

  const opportunityCostScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        estimatedRevenueCost / 50 +
          estimatedProfitCost / 40 +
          input.blockedOperationCount * 6 +
          input.conflictCount * 5,
      ),
    ),
  );

  if (opportunityCostScore >= 60) issues.push("high_opportunity_cost");
  if (input.blockedOperationCount >= 2) issues.push("blocked_value_leaking");

  return { opportunityCostScore, estimatedRevenueCost, estimatedProfitCost, issues };
}
