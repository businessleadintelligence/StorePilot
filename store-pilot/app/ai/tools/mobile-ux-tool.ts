export function auditMobileUx(input: {
  averageTitleLength: number;
  activeProductCount: number;
  hasPrimaryCta: boolean;
  menuDepth: number;
}): { score: number; issues: string[]; touchTargetScore: number; stickyCtaLikely: boolean } {
  const issues: string[] = [];
  const touchTargetScore = input.averageTitleLength >= 15 ? 75 : 50;
  const stickyCtaLikely = input.hasPrimaryCta && input.activeProductCount >= 5;

  if (touchTargetScore < 65) issues.push("mobile_small_touch_targets");
  if (!stickyCtaLikely) issues.push("mobile_missing_sticky_cta");
  if (input.menuDepth > 3) issues.push("mobile_navigation_depth");
  if (input.activeProductCount < 3) issues.push("mobile_sparse_catalog_layout");

  let score = 65;
  if (stickyCtaLikely) score += 15;
  if (touchTargetScore >= 70) score += 10;
  if (input.menuDepth <= 3) score += 10;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    touchTargetScore,
    stickyCtaLikely,
  };
}
