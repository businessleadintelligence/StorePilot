export function calculateTrendHealthScore(input: {
  trendScore: number;
  emergingProductCount: number;
  decliningProductCount: number;
  riskLevel: "low" | "medium" | "high";
}): number {
  let score = input.trendScore;
  score += Math.min(10, input.emergingProductCount * 2);
  score -= Math.min(15, input.decliningProductCount * 3);

  if (input.riskLevel === "high") score -= 12;
  if (input.riskLevel === "medium") score -= 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyTrendHealthBand(score: number): "strong" | "watch" | "weak" {
  if (score >= 80) return "strong";
  if (score >= 60) return "watch";
  return "weak";
}
