import type { StoreAuditFacts } from "../facts/store-audit-facts";

export function shouldExpireStoreAuditRecommendation(input: {
  facts: StoreAuditFacts;
  payload: Record<string, unknown>;
  status: string;
}): boolean {
  if (!["open", "viewed", "implemented"].includes(input.status)) {
    return false;
  }

  const category = String(input.payload.category ?? "");
  const baselineScore = Number(input.payload.baselineSectionScore ?? 0);

  if (category === "Apps" && input.facts.apps.unusedApps === 0) {
    return true;
  }

  if (category === "SEO" && baselineScore > 0 && input.facts.seoScore >= baselineScore + 10) {
    return true;
  }

  if (category === "Homepage" && baselineScore > 0 && input.facts.homepageScore >= baselineScore + 10) {
    return true;
  }

  return false;
}

export function getStoreAuditRecommendationExpirationReason(input: {
  facts: StoreAuditFacts;
  payload: Record<string, unknown>;
}): string | null {
  const category = String(input.payload.category ?? "");

  if (category === "Apps" && input.facts.apps.unusedApps === 0) {
    return "unused_apps_resolved";
  }

  if (category === "SEO") {
    return "seo_score_improved";
  }

  if (category === "Homepage") {
    return "homepage_score_improved";
  }

  return "issue_resolved";
}

export function getStoreAuditRecommendationVerificationReason(input: {
  facts: StoreAuditFacts;
  payload: Record<string, unknown>;
}): boolean {
  const verification = input.payload.verification as
    | { expectedMetric?: string; expectedDirection?: string }
    | undefined;

  if (!verification?.expectedMetric) {
    return false;
  }

  if (verification.expectedMetric === "Performance score") {
    const baseline = Number(input.payload.baselinePerformanceScore ?? 0);
    return baseline > 0 ? input.facts.performanceScore > baseline : input.facts.performanceScore >= 75;
  }

  if (verification.expectedMetric === "SEO score") {
    const baseline = Number(input.payload.baselineSeoScore ?? 0);
    return baseline > 0 ? input.facts.seoScore > baseline : input.facts.seoScore >= 75;
  }

  if (verification.expectedMetric === "Store health score") {
    const baseline = Number(input.payload.baselineStoreHealthScore ?? 0);
    return baseline > 0 ? input.facts.storeHealthScore > baseline : input.facts.storeHealthScore >= 80;
  }

  return input.facts.storeHealthScore >= 70;
}
