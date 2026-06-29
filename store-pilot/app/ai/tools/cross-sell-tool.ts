export function analyzeCrossSellOpportunity(input: {
  attachRateProxy: number;
  bundleCandidateCount: number;
  multiItemOrderRate: number;
  complementaryPairCount: number;
}): { crossSellOpportunity: number; pairCount: number; issues: string[] } {
  const issues: string[] = [];
  const crossSellOpportunity = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        input.attachRateProxy * 45 +
          input.bundleCandidateCount * 8 +
          input.multiItemOrderRate * 0.35 +
          input.complementaryPairCount * 5,
      ),
    ),
  );
  const pairCount = Math.max(input.complementaryPairCount, input.bundleCandidateCount);

  if (input.multiItemOrderRate < 25) issues.push("low_multi_item_orders");
  if (crossSellOpportunity >= 50) issues.push("cross_sell_opportunity_available");

  return { crossSellOpportunity, pairCount, issues };
}
