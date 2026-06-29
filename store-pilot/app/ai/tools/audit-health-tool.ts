export function calculateStoreAuditHealthScore(input: {
  homepageScore: number;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  conversionScore: number;
  mobileScore: number;
  themeScore: number;
  criticalIssueCount: number;
}): number {
  let score =
    input.homepageScore * 0.15 +
    input.performanceScore * 0.12 +
    input.seoScore * 0.15 +
    input.accessibilityScore * 0.12 +
    input.conversionScore * 0.15 +
    input.mobileScore * 0.12 +
    input.themeScore * 0.12 +
    9;
  score -= Math.min(input.criticalIssueCount, 12) * 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyStoreAuditHealthBand(score: number): "strong" | "watch" | "weak" {
  if (score >= 80) return "strong";
  if (score >= 60) return "watch";
  return "weak";
}
