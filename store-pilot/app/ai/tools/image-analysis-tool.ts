export function analyzeImages(input: {
  missingAltTextProxy: number;
  totalProducts: number;
  imageOptimizationScore: number;
  largeCatalog: boolean;
}): {
  score: number;
  issues: string[];
  altTextCoverage: number;
  optimizationScore: number;
} {
  const issues: string[] = [];
  const altTextCoverage =
    input.totalProducts === 0
      ? 0
      : Math.round(
          ((input.totalProducts - input.missingAltTextProxy) / input.totalProducts) * 100,
        );
  const optimizationScore = input.imageOptimizationScore;

  if (altTextCoverage < 80) issues.push("images_missing_alt_text");
  if (optimizationScore < 65) issues.push("images_need_compression");
  if (input.largeCatalog && optimizationScore < 75) issues.push("images_catalog_weight_risk");

  let score = Math.round(altTextCoverage * 0.55 + optimizationScore * 0.45);
  if (altTextCoverage < 60) score -= 8;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    altTextCoverage,
    optimizationScore,
  };
}
