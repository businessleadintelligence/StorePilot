export function analyzeUpsellOpportunity(input: {
  highVelocityProducts: number;
  lowBasketDepthOrders: number;
  totalOrders: number;
  premiumProductCount: number;
  medianPrice: number;
  productsAboveMedian: number;
}): { upsellOpportunity: number; candidateCount: number; issues: string[] } {
  const issues: string[] = [];
  const lowBasketShare =
    input.totalOrders <= 0 ? 0 : Math.round((input.lowBasketDepthOrders / input.totalOrders) * 100);
  const upsellOpportunity = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        lowBasketShare * 0.35 +
          input.highVelocityProducts * 4 +
          input.premiumProductCount * 3 +
          input.productsAboveMedian * 1.5,
      ),
    ),
  );
  const candidateCount = Math.max(0, input.highVelocityProducts + Math.floor(input.premiumProductCount / 2));

  if (lowBasketShare >= 45) issues.push("upsell_basket_depth_gap");
  if (upsellOpportunity >= 55) issues.push("upsell_opportunity_available");

  return { upsellOpportunity, candidateCount, issues };
}
