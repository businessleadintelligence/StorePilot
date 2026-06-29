export function analyzePricingCompetition(input: {
  medianPrice: number;
  prices: number[];
}): { score: number; underpricedCount: number; overpricedCount: number; issues: string[] } {
  if (input.prices.length === 0 || input.medianPrice <= 0) {
    return { score: 50, underpricedCount: 0, overpricedCount: 0, issues: [] };
  }
  const underpricedCount = input.prices.filter((price) => price < input.medianPrice * 0.75).length;
  const overpricedCount = input.prices.filter((price) => price > input.medianPrice * 1.35).length;
  const issues: string[] = [];
  if (underpricedCount > 0) issues.push("underpriced_vs_market_proxy");
  if (overpricedCount > 0) issues.push("overpriced_vs_market_proxy");
  const score = Math.max(
    0,
    Math.min(
      100,
      100 - Math.round(((underpricedCount + overpricedCount) / input.prices.length) * 100),
    ),
  );
  return { score, underpricedCount, overpricedCount, issues };
}
