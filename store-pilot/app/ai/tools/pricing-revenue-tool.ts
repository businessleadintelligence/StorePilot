export function analyzePricingRevenue(input: {
  totalRevenue: number;
  previousRevenue: number;
  aov: number;
}): { revenueTrend: number; revenueRisk: number; issues: string[] } {
  const issues: string[] = [];
  const revenueTrend =
    input.previousRevenue <= 0
      ? 0
      : Number((((input.totalRevenue - input.previousRevenue) / input.previousRevenue) * 100).toFixed(2));
  if (revenueTrend < -10) issues.push("revenue_declining");
  if (input.aov < 25) issues.push("aov_too_low");
  const revenueRisk = Math.max(0, Math.min(100, Math.round(Math.max(0, -revenueTrend) + (input.aov < 30 ? 15 : 0))));
  return { revenueTrend, revenueRisk, issues };
}
