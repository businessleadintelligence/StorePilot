export function analyzePricingDemand(input: {
  totalUnitsSold: number;
  totalProducts: number;
  velocity: number;
}): { demandScore: number; issues: string[] } {
  const issues: string[] = [];
  const demandScore = Math.min(100, Math.round(input.velocity * 8 + input.totalUnitsSold / Math.max(1, input.totalProducts)));
  if (demandScore < 40) issues.push("weak_demand_signal");
  if (demandScore >= 75) issues.push("strong_demand_no_discount_needed");
  return { demandScore, issues };
}
