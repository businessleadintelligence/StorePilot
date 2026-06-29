export function analyzeRevenueGrowth(input: {
  totalRevenue30: number;
  previousRevenue30: number;
  totalRevenue90: number;
}): { revenueGrowthRate: number; score: number; issues: string[] } {
  const issues: string[] = [];
  const revenueGrowthRate =
    input.previousRevenue30 <= 0
      ? 0
      : Number((((input.totalRevenue30 - input.previousRevenue30) / input.previousRevenue30) * 100).toFixed(2));

  if (revenueGrowthRate < -10) issues.push("revenue_declining");
  if (revenueGrowthRate >= 15) issues.push("strong_revenue_momentum");

  const normalized = Math.max(0, Math.min(100, Math.round(50 + revenueGrowthRate)));
  const trailingMomentum =
    input.totalRevenue90 <= 0
      ? 0
      : Number(((input.totalRevenue30 * 3 - input.totalRevenue90) / input.totalRevenue90).toFixed(2));
  const score = Math.max(0, Math.min(100, Math.round(normalized * 0.7 + Math.max(0, 50 + trailingMomentum) * 0.3)));

  return { revenueGrowthRate, score, issues };
}
