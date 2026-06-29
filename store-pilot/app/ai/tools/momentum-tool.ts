export function calculateMomentum(input: {
  sales7Days: number;
  sales30Days: number;
  velocity: number;
}): number {
  const normalizedWeekly = (input.sales30Days / 30) * 7;
  const growthRatio = normalizedWeekly === 0 ? (input.sales7Days > 0 ? 1.5 : 0) : input.sales7Days / normalizedWeekly;
  const velocityFactor = Math.min(1.5, input.velocity / 2);
  return Number(Math.max(0, Math.min(1, (growthRatio - 0.85) * velocityFactor)).toFixed(2));
}

export function classifyMomentumBand(momentum: number): "strong" | "moderate" | "weak" {
  if (momentum >= 0.65) return "strong";
  if (momentum >= 0.35) return "moderate";
  return "weak";
}
