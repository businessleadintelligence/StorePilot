export function analyzeGrowthRisk(input: {
  revenueGrowthRate: number;
  retentionScore: number;
  growthRiskFromInventory: number;
  growthRiskFromPricing: number;
  refundRate: number;
}): { growthRisk: number; issues: string[] } {
  const issues: string[] = [];
  const revenueRisk = Math.max(0, Math.min(100, Math.round(Math.max(0, -input.revenueGrowthRate) + 10)));
  const retentionRisk = Math.max(0, 100 - input.retentionScore);
  const refundRisk = Math.max(0, Math.min(100, Math.round(input.refundRate * 5)));
  const growthRisk = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        revenueRisk * 0.3 +
          retentionRisk * 0.25 +
          input.growthRiskFromInventory * 0.2 +
          input.growthRiskFromPricing * 0.15 +
          refundRisk * 0.1,
      ),
    ),
  );

  if (growthRisk >= 60) issues.push("growth_risk_elevated");
  if (retentionRisk >= 45) issues.push("retention_risk");
  if (revenueRisk >= 25) issues.push("revenue_decline_risk");

  return { growthRisk, issues };
}
