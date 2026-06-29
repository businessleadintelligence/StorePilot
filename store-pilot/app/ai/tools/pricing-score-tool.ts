export type PricingScoreInput = {
  marginPercent: number;
  averageDiscountPercent: number;
  discountFrequency: number;
  priceConsistencyScore: number;
  discountDependence: number;
  revenueRisk: number;
  profitRisk: number;
  inventoryRisk: number;
  premiumOpportunityScore: number;
  psychologicalOpportunityScore: number;
  bundleOpportunityScore: number;
  elasticityRisk: number;
};

export type PricingIntelligenceScores = {
  pricingHealthScore: number;
  marginPercent: number;
  averageDiscountPercent: number;
  discountFrequency: number;
  revenue: number;
  grossProfit: number;
  inventoryCost: number;
  inventoryCoverage: number;
  revenuePerVisitor: number;
  conversionRate: number;
  aov: number;
  pricePositionScore: number;
  markdownPercent: number;
  sellThrough: number;
  profitTrend: number;
  velocity: number;
  inventoryRisk: number;
  bundlePriceOpportunity: number;
  premiumPricingOpportunity: number;
  psychologicalPricingOpportunity: number;
  priceConsistencyScore: number;
  discountDependence: number;
  revenueRisk: number;
  profitRisk: number;
};

export function calculatePricingHealthScore(input: PricingScoreInput): number {
  let score =
    input.marginPercent * 0.22 +
    (100 - input.averageDiscountPercent) * 0.12 +
    (100 - input.discountFrequency) * 0.1 +
    input.priceConsistencyScore * 0.15 +
    (100 - input.discountDependence) * 0.1 +
    (100 - input.revenueRisk) * 0.08 +
    (100 - input.profitRisk) * 0.08 +
    (100 - input.inventoryRisk) * 0.05 +
    input.premiumOpportunityScore * 0.05 +
    input.psychologicalOpportunityScore * 0.03 +
    input.bundleOpportunityScore * 0.02;

  score -= Math.min(input.elasticityRisk, 20);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculatePricingIntelligenceScores(input: {
  totalRevenue: number;
  totalGrossProfit: number;
  inventoryCost: number;
  inventoryCoverage: number;
  revenuePerVisitor: number;
  conversionRate: number;
  aov: number;
  marginPercent: number;
  averageDiscountPercent: number;
  discountFrequency: number;
  pricePositionScore: number;
  markdownPercent: number;
  sellThrough: number;
  profitTrend: number;
  velocity: number;
  inventoryRisk: number;
  bundlePriceOpportunity: number;
  premiumPricingOpportunity: number;
  psychologicalPricingOpportunity: number;
  priceConsistencyScore: number;
  discountDependence: number;
  revenueRisk: number;
  profitRisk: number;
  elasticityRisk: number;
}): PricingIntelligenceScores {
  const pricingHealthScore = calculatePricingHealthScore({
    marginPercent: input.marginPercent,
    averageDiscountPercent: input.averageDiscountPercent,
    discountFrequency: input.discountFrequency,
    priceConsistencyScore: input.priceConsistencyScore,
    discountDependence: input.discountDependence,
    revenueRisk: input.revenueRisk,
    profitRisk: input.profitRisk,
    inventoryRisk: input.inventoryRisk,
    premiumOpportunityScore: input.premiumPricingOpportunity,
    psychologicalOpportunityScore: input.psychologicalPricingOpportunity,
    bundleOpportunityScore: input.bundlePriceOpportunity,
    elasticityRisk: input.elasticityRisk,
  });

  return {
    pricingHealthScore,
    marginPercent: input.marginPercent,
    averageDiscountPercent: input.averageDiscountPercent,
    discountFrequency: input.discountFrequency,
    revenue: input.totalRevenue,
    grossProfit: input.totalGrossProfit,
    inventoryCost: input.inventoryCost,
    inventoryCoverage: input.inventoryCoverage,
    revenuePerVisitor: input.revenuePerVisitor,
    conversionRate: input.conversionRate,
    aov: input.aov,
    pricePositionScore: input.pricePositionScore,
    markdownPercent: input.markdownPercent,
    sellThrough: input.sellThrough,
    profitTrend: input.profitTrend,
    velocity: input.velocity,
    inventoryRisk: input.inventoryRisk,
    bundlePriceOpportunity: input.bundlePriceOpportunity,
    premiumPricingOpportunity: input.premiumPricingOpportunity,
    psychologicalPricingOpportunity: input.psychologicalPricingOpportunity,
    priceConsistencyScore: input.priceConsistencyScore,
    discountDependence: input.discountDependence,
    revenueRisk: input.revenueRisk,
    profitRisk: input.profitRisk,
  };
}
