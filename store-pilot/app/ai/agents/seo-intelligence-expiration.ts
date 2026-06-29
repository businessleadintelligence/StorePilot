import type { SeoIntelligenceFacts } from "../facts/seo-intelligence-facts";

export function shouldExpireSeoRecommendation(input: {
  facts: SeoIntelligenceFacts;
  payload: Record<string, unknown>;
  status: string;
}): boolean {
  if (!["open", "viewed", "implemented"].includes(input.status)) {
    return false;
  }

  const category = String(input.payload.category ?? "");
  const baselineScore = Number(input.payload.baselineSectionScore ?? 0);

  if (
    category === "Metadata" &&
    baselineScore > 0 &&
    input.facts.scores.contentScore >= baselineScore + 10
  ) {
    return true;
  }

  if (
    category === "Technical SEO" &&
    baselineScore > 0 &&
    input.facts.scores.technicalSeoScore >= baselineScore + 10
  ) {
    return true;
  }

  if (
    category === "Core Web Vitals" &&
    baselineScore > 0 &&
    input.facts.scores.coreWebVitalsScore >= baselineScore + 10
  ) {
    return true;
  }

  return false;
}

export function getSeoRecommendationExpirationReason(input: {
  facts: SeoIntelligenceFacts;
  payload: Record<string, unknown>;
}): string | null {
  const category = String(input.payload.category ?? "");

  if (category === "Metadata") {
    return "metadata_score_improved";
  }

  if (category === "Technical SEO") {
    return "technical_seo_score_improved";
  }

  if (category === "Core Web Vitals") {
    return "core_web_vitals_improved";
  }

  return "issue_resolved";
}

export function getSeoRecommendationVerificationReason(input: {
  facts: SeoIntelligenceFacts;
  payload: Record<string, unknown>;
}): boolean {
  const verification = input.payload.verification as
    | { expectedMetric?: string; expectedDirection?: string }
    | undefined;

  if (!verification?.expectedMetric) {
    return false;
  }

  if (verification.expectedMetric === "SEO health score") {
    const baseline = Number(input.payload.baselineSeoHealthScore ?? 0);
    return baseline > 0 ? input.facts.seoHealthScore > baseline : input.facts.seoHealthScore >= 80;
  }

  if (verification.expectedMetric === "Search visibility score") {
    const baseline = Number(input.payload.baselineSearchVisibilityScore ?? 0);
    return baseline > 0
      ? input.facts.scores.searchVisibilityScore > baseline
      : input.facts.scores.searchVisibilityScore >= 75;
  }

  if (verification.expectedMetric === "Core Web Vitals score") {
    const baseline = Number(input.payload.baselineCoreWebVitalsScore ?? 0);
    return baseline > 0
      ? input.facts.scores.coreWebVitalsScore > baseline
      : input.facts.scores.coreWebVitalsScore >= 75;
  }

  return input.facts.seoHealthScore >= 70;
}
