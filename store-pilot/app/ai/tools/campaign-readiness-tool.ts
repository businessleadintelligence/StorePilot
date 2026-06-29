export function analyzeCampaignReadiness(input: {
  growthScore: number;
  inventoryCoverageScore: number;
  landingPageScore: number;
  seoScore: number;
  outOfStockProducts: number;
  activeProducts: number;
}): { campaignReadinessScore: number; readySegments: number; issues: string[] } {
  const issues: string[] = [];
  const stockHealth =
    input.activeProducts <= 0
      ? 0
      : Math.max(0, 100 - Math.round((input.outOfStockProducts / input.activeProducts) * 100));
  const campaignReadinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        input.growthScore * 0.25 +
          input.inventoryCoverageScore * 0.2 +
          input.landingPageScore * 0.2 +
          input.seoScore * 0.15 +
          stockHealth * 0.2,
      ),
    ),
  );
  const readySegments = Math.max(
    0,
    Math.floor(campaignReadinessScore / 25) +
      (input.landingPageScore >= 60 ? 1 : 0) +
      (input.seoScore >= 60 ? 1 : 0),
  );

  if (input.outOfStockProducts >= 3) issues.push("campaign_stock_risk");
  if (input.landingPageScore < 55) issues.push("landing_pages_not_campaign_ready");
  if (campaignReadinessScore >= 65) issues.push("campaign_launch_ready");

  return { campaignReadinessScore, readySegments, issues };
}
