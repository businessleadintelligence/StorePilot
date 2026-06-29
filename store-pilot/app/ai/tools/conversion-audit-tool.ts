export function auditConversion(input: {
  recentOrderCount: number;
  averageOrderValue: number;
  activeProductCount: number;
  draftProducts: number;
  bundleVisibilityScore: number;
}): {
  score: number;
  issues: string[];
  cartFrictionScore: number;
  socialProofScore: number;
  upsellVisibility: number;
} {
  const issues: string[] = [];
  const cartFrictionScore = input.draftProducts > 0 ? 45 : input.recentOrderCount >= 10 ? 80 : 55;
  const socialProofScore = input.recentOrderCount >= 20 ? 85 : input.recentOrderCount >= 5 ? 60 : 35;
  const upsellVisibility = input.bundleVisibilityScore;

  if (cartFrictionScore < 60) issues.push("conversion_cart_friction");
  if (socialProofScore < 60) issues.push("conversion_missing_social_proof");
  if (upsellVisibility < 50) issues.push("conversion_low_upsell_visibility");
  if (input.averageOrderValue < 25 && input.activeProductCount > 5) issues.push("conversion_low_aov");

  let score = 55;
  score += Math.round(cartFrictionScore * 0.2);
  score += Math.round(socialProofScore * 0.2);
  score += Math.round(upsellVisibility * 0.15);

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    cartFrictionScore,
    socialProofScore,
    upsellVisibility,
  };
}
