export function analyzeGrowthOpportunity(input: {
  revenueOpportunity: number;
  upsellOpportunity: number;
  crossSellOpportunity: number;
  retentionScore: number;
  collectionGrowthScore: number;
  campaignReadinessScore: number;
}): {
  totalOpportunityScore: number;
  immediateWinCount: number;
  strategicOpportunityCount: number;
  issues: string[];
} {
  const issues: string[] = [];
  const totalOpportunityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        input.revenueOpportunity * 0.25 +
          input.upsellOpportunity * 0.2 +
          input.crossSellOpportunity * 0.2 +
          input.retentionScore * 0.15 +
          input.collectionGrowthScore * 0.1 +
          input.campaignReadinessScore * 0.1,
      ),
    ),
  );
  const immediateWinCount =
    (input.upsellOpportunity >= 55 ? 1 : 0) +
    (input.crossSellOpportunity >= 55 ? 1 : 0) +
    (input.campaignReadinessScore >= 65 ? 1 : 0);
  const strategicOpportunityCount =
    (input.collectionGrowthScore >= 50 ? 1 : 0) + (input.retentionScore >= 55 ? 1 : 0);

  if (totalOpportunityScore >= 65) issues.push("growth_opportunity_available");
  if (immediateWinCount === 0) issues.push("limited_immediate_wins");

  return { totalOpportunityScore, immediateWinCount, strategicOpportunityCount, issues };
}
