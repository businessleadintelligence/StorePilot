export function analyzePolicies(input: {
  hasCompletedOnboarding: boolean;
  activeProductCount: number;
  recentOrderCount: number;
}): {
  score: number;
  issues: string[];
  refundPolicyLikely: boolean;
  shippingPolicyLikely: boolean;
  privacyPolicyLikely: boolean;
} {
  const issues: string[] = [];
  const refundPolicyLikely = input.hasCompletedOnboarding && input.recentOrderCount > 0;
  const shippingPolicyLikely = input.activeProductCount >= 3;
  const privacyPolicyLikely = input.hasCompletedOnboarding;

  if (!refundPolicyLikely) issues.push("policy_refund_missing");
  if (!shippingPolicyLikely) issues.push("policy_shipping_missing");
  if (!privacyPolicyLikely) issues.push("policy_privacy_missing");

  let score = 55;
  if (refundPolicyLikely) score += 15;
  if (shippingPolicyLikely) score += 15;
  if (privacyPolicyLikely) score += 15;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    refundPolicyLikely,
    shippingPolicyLikely,
    privacyPolicyLikely,
  };
}

export function analyzeMerchantBestPractices(input: {
  hasCompletedOnboarding: boolean;
  missingSku: number;
  shortTitles: number;
  activeProductCount: number;
  draftProductCount: number;
}): {
  score: number;
  issues: string[];
  catalogComplete: boolean;
  onboardingComplete: boolean;
} {
  const issues: string[] = [];
  const catalogComplete = input.missingSku === 0 && input.shortTitles === 0;
  const onboardingComplete = input.hasCompletedOnboarding;

  if (!onboardingComplete) issues.push("merchant_onboarding_incomplete");
  if (input.missingSku > 0) issues.push("merchant_missing_sku");
  if (input.shortTitles > 0) issues.push("merchant_short_titles");
  if (input.draftProductCount > input.activeProductCount) issues.push("merchant_draft_backlog");

  let score = 60;
  if (catalogComplete) score += 20;
  if (onboardingComplete) score += 10;
  if (input.activeProductCount >= 10) score += 10;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    catalogComplete,
    onboardingComplete,
  };
}
