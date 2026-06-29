export function analyzePricingBundle(input: {
  bundleCandidateCount: number;
  attachRateProxy: number;
  totalProducts: number;
}): { score: number; bundlePriceOpportunity: number; issues: string[] } {
  const issues: string[] = [];
  const bundlePriceOpportunity = Math.min(
    100,
    Math.round(input.bundleCandidateCount * 12 + input.attachRateProxy * 40),
  );
  if (bundlePriceOpportunity >= 40) issues.push("bundle_pricing_opportunity");
  const score = Math.max(0, bundlePriceOpportunity);
  return { score, bundlePriceOpportunity, issues };
}
