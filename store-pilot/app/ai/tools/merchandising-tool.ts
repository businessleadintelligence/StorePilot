export function analyzeMerchandising(input: {
  activeProducts: number;
  heroProductCount: number;
  slowMoverCount: number;
  fastMoverCount: number;
  collectionCount: number;
  bundleOpportunityCount: number;
}): { merchandisingScore: number; gapCount: number; issues: string[] } {
  const issues: string[] = [];
  const heroCoverage =
    input.activeProducts <= 0 ? 0 : Math.round((input.heroProductCount / input.activeProducts) * 100);
  const slowShare =
    input.activeProducts <= 0 ? 0 : Math.round((input.slowMoverCount / input.activeProducts) * 100);
  const merchandisingScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        heroCoverage * 0.3 +
          Math.max(0, 100 - slowShare) * 0.25 +
          Math.min(100, input.collectionCount * 8) * 0.2 +
          Math.min(100, input.bundleOpportunityCount * 10) * 0.15 +
          Math.min(100, input.fastMoverCount * 5) * 0.1,
      ),
    ),
  );
  const gapCount = Math.max(0, input.slowMoverCount + Math.max(0, 3 - input.heroProductCount));

  if (input.heroProductCount < 3) issues.push("weak_hero_merchandising");
  if (input.slowMoverCount >= 5) issues.push("slow_movers_need_merchandising");
  if (merchandisingScore >= 65) issues.push("merchandising_foundation_strong");

  return { merchandisingScore, gapCount, issues };
}
