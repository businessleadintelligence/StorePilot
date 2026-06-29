export function auditTheme(input: {
  activeProductCount: number;
  webhookCount: number;
  largeCatalog: boolean;
  syncLatencyDays: number | null;
}): {
  score: number;
  issues: string[];
  jsBundleRisk: boolean;
  cssSizeRisk: boolean;
  imageOptimizationScore: number;
  lazyLoadingLikely: boolean;
} {
  const issues: string[] = [];
  const jsBundleRisk = input.webhookCount > 8 || input.activeProductCount > 200;
  const cssSizeRisk = input.webhookCount > 5;
  const imageOptimizationScore = input.largeCatalog ? 55 : 75;
  const lazyLoadingLikely = input.activeProductCount >= 20;

  if (jsBundleRisk) issues.push("theme_large_js_bundle_risk");
  if (cssSizeRisk) issues.push("theme_css_bloat_risk");
  if (imageOptimizationScore < 65) issues.push("theme_image_optimization_needed");
  if (!lazyLoadingLikely && input.activeProductCount >= 10) issues.push("theme_lazy_loading_missing");
  if (input.syncLatencyDays !== null && input.syncLatencyDays > 7) issues.push("theme_stale_asset_sync");

  let score = 72;
  if (jsBundleRisk) score -= 12;
  if (cssSizeRisk) score -= 8;
  if (imageOptimizationScore < 65) score -= 10;
  if (input.syncLatencyDays !== null && input.syncLatencyDays > 7) score -= 5;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    jsBundleRisk,
    cssSizeRisk,
    imageOptimizationScore,
    lazyLoadingLikely,
  };
}
