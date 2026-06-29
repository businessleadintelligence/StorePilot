export function analyzePricingMargin(input: {
  totalRevenue: number;
  estimatedCostRatio: number;
}): { marginPercent: number; grossProfit: number; issues: string[] } {
  const grossProfit = Number((input.totalRevenue * (1 - input.estimatedCostRatio)).toFixed(2));
  const marginPercent =
    input.totalRevenue <= 0 ? 0 : Math.round((grossProfit / input.totalRevenue) * 100);
  const issues: string[] = [];
  if (marginPercent < 35) issues.push("margin_below_target");
  if (marginPercent < 25) issues.push("margin_critical");
  return { marginPercent, grossProfit, issues };
}
