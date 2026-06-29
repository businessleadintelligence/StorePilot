export function analyzeSeoSearchVisibility(input: {
  averagePositionProxy: number;
  averageCtrProxy: number;
  impressionsProxy: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (input.averagePositionProxy > 15) issues.push("visibility_low_average_position");
  if (input.averageCtrProxy < 0.02) issues.push("visibility_low_ctr");
  if (input.impressionsProxy < 100) issues.push("visibility_low_impressions");
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.max(0, 30 - input.averagePositionProxy) * 2 + input.averageCtrProxy * 500 + input.impressionsProxy / 20,
      ),
    ),
  );
  return { score, issues };
}
