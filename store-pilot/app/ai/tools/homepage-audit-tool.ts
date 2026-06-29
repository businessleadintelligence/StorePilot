export type HomepageAuditSignals = {
  hasHeroContent: boolean;
  hasValueProposition: boolean;
  hasPrimaryCta: boolean;
  hasSecondaryCta: boolean;
  hasTrustBadges: boolean;
  hasSocialProof: boolean;
  hasAnnouncementBar: boolean;
  bannerHierarchyScore: number;
  aboveFoldScore: number;
};

export function auditHomepage(input: {
  storeName: string;
  activeProductCount: number;
  recentOrderCount: number;
  hasCompletedOnboarding: boolean;
}): { score: number; signals: HomepageAuditSignals; issues: string[] } {
  const issues: string[] = [];
  const hasHeroContent = input.storeName.length >= 3 && input.activeProductCount >= 3;
  const hasValueProposition = input.activeProductCount >= 5;
  const hasPrimaryCta = input.hasCompletedOnboarding && input.activeProductCount > 0;
  const hasSecondaryCta = input.activeProductCount >= 8;
  const hasTrustBadges = input.recentOrderCount >= 5;
  const hasSocialProof = input.recentOrderCount >= 10;
  const hasAnnouncementBar = input.hasCompletedOnboarding;
  const bannerHierarchyScore = hasHeroContent && hasPrimaryCta ? 85 : hasHeroContent ? 60 : 35;
  const aboveFoldScore = hasValueProposition && hasPrimaryCta ? 80 : 45;

  if (!hasHeroContent) issues.push("homepage_missing_hero");
  if (!hasValueProposition) issues.push("homepage_weak_value_proposition");
  if (!hasPrimaryCta) issues.push("homepage_missing_primary_cta");
  if (!hasTrustBadges) issues.push("homepage_missing_trust_badges");
  if (!hasSocialProof) issues.push("homepage_missing_social_proof");

  let score = 50;
  if (hasHeroContent) score += 10;
  if (hasValueProposition) score += 10;
  if (hasPrimaryCta) score += 10;
  if (hasTrustBadges) score += 8;
  if (hasSocialProof) score += 7;
  if (hasAnnouncementBar) score += 5;

  return {
    score: Math.max(0, Math.min(100, score)),
    signals: {
      hasHeroContent,
      hasValueProposition,
      hasPrimaryCta,
      hasSecondaryCta,
      hasTrustBadges,
      hasSocialProof,
      hasAnnouncementBar,
      bannerHierarchyScore,
      aboveFoldScore,
    },
    issues,
  };
}
