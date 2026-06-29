export function analyzePricingElasticity(input: {
  averageDiscountPercent: number;
  velocityTrend: number;
  conversionRate: number;
}): { elasticityScore: number; elasticityRisk: number; issues: string[]; priceSensitive: boolean } {
  const issues: string[] = [];
  const priceSensitive =
    input.averageDiscountPercent > 15 && input.velocityTrend > 0 && input.conversionRate < 0.04;
  if (priceSensitive) issues.push("price_sensitivity_rising");
  if (input.averageDiscountPercent > 25 && input.velocityTrend <= 0) {
    issues.push("discount_not_lifting_demand");
  }
  const elasticityScore = Math.max(
    0,
    Math.min(100, Math.round(60 + input.velocityTrend * 10 - input.averageDiscountPercent * 0.8)),
  );
  const elasticityRisk = priceSensitive ? Math.min(100, 40 + input.averageDiscountPercent) : Math.max(0, 20 - input.velocityTrend * 5);
  return { elasticityScore, elasticityRisk, issues, priceSensitive };
}
