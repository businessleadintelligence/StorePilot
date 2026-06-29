export function analyzePricingPsychology(input: {
  prices: number[];
}): { score: number; opportunityCount: number; issues: string[] } {
  const issues: string[] = [];
  let opportunityCount = 0;
  for (const price of input.prices) {
    const cents = Math.round((price % 1) * 100);
    if (cents === 0 || cents === 50) opportunityCount += 1;
    if (price > 20 && cents !== 99 && cents !== 95 && cents !== 97) opportunityCount += 1;
  }
  if (opportunityCount > 0) issues.push("psychological_pricing_opportunity");
  const score = input.prices.length === 0 ? 0 : Math.max(0, 100 - Math.round((opportunityCount / input.prices.length) * 100));
  return { score, opportunityCount, issues };
}
