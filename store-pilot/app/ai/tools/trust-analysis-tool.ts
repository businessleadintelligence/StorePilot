export function analyzeTrustSignals(input: {
  recentOrderCount: number;
  hasCompletedOnboarding: boolean;
  socialProofScore: number;
  policyScore: number;
  hasPrimaryCta: boolean;
}): {
  score: number;
  issues: string[];
  socialProofReady: boolean;
  policyReady: boolean;
} {
  const issues: string[] = [];
  const socialProofReady = input.socialProofScore >= 70 && input.recentOrderCount >= 3;
  const policyReady = input.policyScore >= 70;

  if (!socialProofReady) issues.push("trust_missing_social_proof");
  if (!policyReady) issues.push("trust_missing_policies");
  if (!input.hasPrimaryCta) issues.push("trust_missing_primary_cta");
  if (!input.hasCompletedOnboarding) issues.push("trust_incomplete_onboarding");

  let score = 65;
  score += Math.round(input.socialProofScore * 0.2);
  score += Math.round(input.policyScore * 0.15);
  if (input.recentOrderCount >= 5) score += 5;
  if (!policyReady) score -= 10;
  if (!input.hasCompletedOnboarding) score -= 8;
  if (!input.hasPrimaryCta) score -= 8;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    socialProofReady,
    policyReady,
  };
}
