export function analyzePricingPremium(input: {
  highVelocityProducts: number;
  lowDiscountProducts: number;
  averageMarginPercent: number;
  totalProducts: number;
}): { score: number; opportunityCount: number; issues: string[] } {
  const issues: string[] = [];
  const opportunityCount = Math.min(
    input.highVelocityProducts,
    Math.max(0, input.lowDiscountProducts),
  );
  if (opportunityCount > 0 && input.averageMarginPercent >= 35) {
    issues.push("premium_positioning_opportunity");
  }
  const score =
    input.totalProducts <= 0
      ? 0
      : Math.round((opportunityCount / Math.max(1, input.totalProducts)) * 100);
  return { score, opportunityCount, issues };
}
