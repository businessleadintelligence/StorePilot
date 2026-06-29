export function analyzePricingProfit(input: {
  grossProfit: number;
  previousGrossProfit: number;
  marginPercent: number;
}): { profitTrend: number; profitRisk: number; issues: string[] } {
  const issues: string[] = [];
  const profitTrend =
    input.previousGrossProfit <= 0
      ? 0
      : Number((((input.grossProfit - input.previousGrossProfit) / input.previousGrossProfit) * 100).toFixed(2));
  if (profitTrend < -8) issues.push("profit_declining");
  if (input.marginPercent < 30) issues.push("profit_margin_weak");
  const profitRisk = Math.max(0, Math.min(100, Math.round(Math.max(0, -profitTrend) + (input.marginPercent < 35 ? 20 : 0))));
  return { profitTrend, profitRisk, issues };
}
