export function forecastGrowthRate(input: {
  revenueGrowthRate: number;
  aovGrowthRate: number;
  repeatPurchaseRate: number;
  seasonalStrength: number;
  retentionScore: number;
}): { forecastGrowthRate: number; confidence: number; issues: string[] } {
  const issues: string[] = [];
  const baseline =
    input.revenueGrowthRate * 0.45 +
    input.aovGrowthRate * 0.2 +
    input.repeatPurchaseRate * 0.15 +
    input.retentionScore * 0.1;
  const seasonalLift = Math.max(0, (input.seasonalStrength - 1) * 12);
  const forecastGrowthRate = Number(Math.max(-25, Math.min(60, baseline + seasonalLift)).toFixed(2));
  const confidence = Math.max(
    0,
    Math.min(
      1,
      Number(
        (
          0.45 +
          (Math.abs(input.revenueGrowthRate) >= 5 ? 0.15 : 0) +
          (input.retentionScore >= 50 ? 0.15 : 0) +
          (input.seasonalStrength >= 1.2 ? 0.1 : 0)
        ).toFixed(2),
      ),
    ),
  );

  if (forecastGrowthRate < 0) issues.push("negative_growth_forecast");
  if (forecastGrowthRate >= 15) issues.push("strong_growth_forecast");

  return { forecastGrowthRate, confidence, issues };
}
