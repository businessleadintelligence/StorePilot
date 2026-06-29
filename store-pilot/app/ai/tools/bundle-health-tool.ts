export function calculateBundleHealthScore(input: {
  candidateCount: number;
  highConfidenceCount: number;
  deadInventoryPairCount: number;
  averageConfidence: number;
}): number {
  if (input.candidateCount === 0) {
    return 50;
  }

  let score = 55 + input.averageConfidence * 35;
  score += Math.min(10, input.highConfidenceCount * 2);
  score += Math.min(8, input.deadInventoryPairCount);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyBundleHealthBand(score: number): "strong" | "watch" | "weak" {
  if (score >= 80) {
    return "strong";
  }

  if (score >= 60) {
    return "watch";
  }

  return "weak";
}
