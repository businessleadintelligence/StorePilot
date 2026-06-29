export type GrowthScoreInput = {
  revenueGrowthRate: number;
  aovGrowthRate: number;
  repeatPurchaseRate: number;
  returningCustomerRate: number;
  retentionScore: number;
  upsellOpportunity: number;
  crossSellOpportunity: number;
  collectionGrowthScore: number;
  campaignReadinessScore: number;
  landingPageGrowthScore: number;
  merchandisingScore: number;
  growthRisk: number;
  seasonalStrength: number;
  forecastGrowthRate: number;
  capacityScore: number;
};

export type GrowthIntelligenceScores = {
  growthHealthScore: number;
  growthScore: number;
  revenue30: number;
  revenue90: number;
  revenueGrowthRate: number;
  aov: number;
  aovGrowthRate: number;
  repeatPurchaseRate: number;
  returningCustomerRate: number;
  retentionScore: number;
  upsellOpportunity: number;
  crossSellOpportunity: number;
  collectionGrowthScore: number;
  campaignReadinessScore: number;
  landingPageGrowthScore: number;
  merchandisingScore: number;
  growthRisk: number;
  seasonalStrength: number;
  forecastGrowthRate: number;
  capacityScore: number;
  revenueOpportunity: number;
  profitOpportunity: number;
};

export function calculateGrowthHealthScore(input: GrowthScoreInput): number {
  let score =
    Math.max(0, Math.min(100, 50 + input.revenueGrowthRate * 0.35)) * 0.18 +
    Math.max(0, Math.min(100, 50 + input.aovGrowthRate * 0.4)) * 0.12 +
    input.repeatPurchaseRate * 0.12 +
    input.returningCustomerRate * 0.1 +
    input.retentionScore * 0.1 +
    input.upsellOpportunity * 0.06 +
    input.crossSellOpportunity * 0.05 +
    input.collectionGrowthScore * 0.05 +
    input.campaignReadinessScore * 0.05 +
    input.landingPageGrowthScore * 0.05 +
    input.merchandisingScore * 0.04 +
    input.capacityScore * 0.04 +
    Math.min(input.seasonalStrength * 20, 15) * 0.02 +
    Math.max(0, Math.min(100, 50 + input.forecastGrowthRate * 0.3)) * 0.02;

  score -= Math.min(input.growthRisk, 25) * 0.35;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateGrowthScore(input: GrowthScoreInput): number {
  const composite =
    Math.max(0, Math.min(100, 50 + input.revenueGrowthRate * 0.45)) * 0.25 +
    Math.max(0, Math.min(100, 50 + input.aovGrowthRate * 0.5)) * 0.15 +
    input.repeatPurchaseRate * 0.15 +
    input.upsellOpportunity * 0.1 +
    input.crossSellOpportunity * 0.1 +
    input.collectionGrowthScore * 0.08 +
    input.campaignReadinessScore * 0.07 +
    input.merchandisingScore * 0.1;

  return Math.max(0, Math.min(100, Math.round(composite - input.growthRisk * 0.15)));
}

export function calculateGrowthIntelligenceScores(input: {
  revenue30: number;
  revenue90: number;
  revenueGrowthRate: number;
  aov: number;
  aovGrowthRate: number;
  repeatPurchaseRate: number;
  returningCustomerRate: number;
  retentionScore: number;
  upsellOpportunity: number;
  crossSellOpportunity: number;
  collectionGrowthScore: number;
  campaignReadinessScore: number;
  landingPageGrowthScore: number;
  merchandisingScore: number;
  growthRisk: number;
  seasonalStrength: number;
  forecastGrowthRate: number;
  capacityScore: number;
  estimatedMarginPercent: number;
}): GrowthIntelligenceScores {
  const growthHealthScore = calculateGrowthHealthScore({
    revenueGrowthRate: input.revenueGrowthRate,
    aovGrowthRate: input.aovGrowthRate,
    repeatPurchaseRate: input.repeatPurchaseRate,
    returningCustomerRate: input.returningCustomerRate,
    retentionScore: input.retentionScore,
    upsellOpportunity: input.upsellOpportunity,
    crossSellOpportunity: input.crossSellOpportunity,
    collectionGrowthScore: input.collectionGrowthScore,
    campaignReadinessScore: input.campaignReadinessScore,
    landingPageGrowthScore: input.landingPageGrowthScore,
    merchandisingScore: input.merchandisingScore,
    growthRisk: input.growthRisk,
    seasonalStrength: input.seasonalStrength,
    forecastGrowthRate: input.forecastGrowthRate,
    capacityScore: input.capacityScore,
  });

  const growthScore = calculateGrowthScore({
    revenueGrowthRate: input.revenueGrowthRate,
    aovGrowthRate: input.aovGrowthRate,
    repeatPurchaseRate: input.repeatPurchaseRate,
    returningCustomerRate: input.returningCustomerRate,
    retentionScore: input.retentionScore,
    upsellOpportunity: input.upsellOpportunity,
    crossSellOpportunity: input.crossSellOpportunity,
    collectionGrowthScore: input.collectionGrowthScore,
    campaignReadinessScore: input.campaignReadinessScore,
    landingPageGrowthScore: input.landingPageGrowthScore,
    merchandisingScore: input.merchandisingScore,
    growthRisk: input.growthRisk,
    seasonalStrength: input.seasonalStrength,
    forecastGrowthRate: input.forecastGrowthRate,
    capacityScore: input.capacityScore,
  });

  const revenueOpportunity = Math.round(
    Math.max(0, 100 - growthScore) * 18 + input.upsellOpportunity * 8 + input.crossSellOpportunity * 6,
  );
  const profitOpportunity = Math.round(
    revenueOpportunity * (input.estimatedMarginPercent / 100) * 0.65 +
      Math.max(0, 35 - input.retentionScore) * 12,
  );

  return {
    growthHealthScore,
    growthScore,
    revenue30: input.revenue30,
    revenue90: input.revenue90,
    revenueGrowthRate: input.revenueGrowthRate,
    aov: input.aov,
    aovGrowthRate: input.aovGrowthRate,
    repeatPurchaseRate: input.repeatPurchaseRate,
    returningCustomerRate: input.returningCustomerRate,
    retentionScore: input.retentionScore,
    upsellOpportunity: input.upsellOpportunity,
    crossSellOpportunity: input.crossSellOpportunity,
    collectionGrowthScore: input.collectionGrowthScore,
    campaignReadinessScore: input.campaignReadinessScore,
    landingPageGrowthScore: input.landingPageGrowthScore,
    merchandisingScore: input.merchandisingScore,
    growthRisk: input.growthRisk,
    seasonalStrength: input.seasonalStrength,
    forecastGrowthRate: input.forecastGrowthRate,
    capacityScore: input.capacityScore,
    revenueOpportunity,
    profitOpportunity,
  };
}
