export function analyzeAovGrowth(input: {
  aov30: number;
  previousAov30: number;
  itemsPerOrder: number;
}): { aovGrowthRate: number; score: number; issues: string[] } {
  const issues: string[] = [];
  const aovGrowthRate =
    input.previousAov30 <= 0
      ? 0
      : Number((((input.aov30 - input.previousAov30) / input.previousAov30) * 100).toFixed(2));

  if (input.aov30 < 35) issues.push("aov_below_target");
  if (aovGrowthRate < -8) issues.push("aov_declining");
  if (input.itemsPerOrder < 1.2) issues.push("low_basket_depth");

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.max(0, 50 + aovGrowthRate * 0.6) * 0.55 +
          Math.min(100, input.aov30) * 0.25 +
          Math.min(100, input.itemsPerOrder * 35) * 0.2,
      ),
    ),
  );

  return { aovGrowthRate, score, issues };
}
