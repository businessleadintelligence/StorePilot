import type { GrowthIntelligenceFacts } from "../facts/growth-intelligence-facts";

export type GrowthRecommendationExpirationReason =
  | "retention_improved"
  | "revenue_momentum_improved"
  | "upsell_opportunity_realized"
  | "capacity_normalized"
  | "issue_resolved";

export function shouldExpireGrowthRecommendation(input: {
  facts: GrowthIntelligenceFacts;
  payload: Record<string, unknown>;
  status: string;
}): boolean {
  if (!["open", "viewed", "implemented"].includes(input.status)) {
    return false;
  }

  const category = String(input.payload.category ?? "");
  const baselineScore = Number(input.payload.baselineSectionScore ?? 0);

  if (
    category === "Revenue Growth" &&
    baselineScore > 0 &&
    input.facts.revenue.score >= baselineScore + 10
  ) {
    return true;
  }

  if (
    category === "Retention" &&
    baselineScore > 0 &&
    input.facts.retention.retentionScore >= baselineScore + 5
  ) {
    return true;
  }

  if (
    category === "Upsell" &&
    input.facts.strategySignals.upsellCandidates === 0 &&
    input.facts.upsell.candidateCount === 0
  ) {
    return true;
  }

  if (
    category === "Campaigns" &&
    input.facts.capacity.capacityScore >= 75 &&
    input.facts.capacity.issues.length === 0
  ) {
    return true;
  }

  if (
    input.facts.growthHealthScore >= 85 &&
    input.facts.criticalIssueCount === 0 &&
    category !== "Seasonal Growth"
  ) {
    return true;
  }

  return false;
}

export function getGrowthRecommendationExpirationReason(input: {
  facts: GrowthIntelligenceFacts;
  payload: Record<string, unknown>;
}): GrowthRecommendationExpirationReason | null {
  const category = String(input.payload.category ?? "");

  if (category === "Retention" || category === "Repeat Purchases") {
    return "retention_improved";
  }

  if (category === "Revenue Growth" || category === "Seasonal Growth") {
    return "revenue_momentum_improved";
  }

  if (category === "Upsell" || category === "AOV Growth") {
    return "upsell_opportunity_realized";
  }

  if (category === "Campaigns" || category === "Landing Pages") {
    return "capacity_normalized";
  }

  return "issue_resolved";
}

export function getGrowthRecommendationVerificationReason(input: {
  facts: GrowthIntelligenceFacts;
  payload: Record<string, unknown>;
}): boolean {
  const verification = input.payload.verification as
    | { expectedMetric?: string; expectedDirection?: string }
    | undefined;

  if (!verification?.expectedMetric) {
    return false;
  }

  if (verification.expectedMetric === "Growth health score") {
    const baseline = Number(input.payload.baselineGrowthHealthScore ?? 0);
    return baseline > 0 ? input.facts.growthHealthScore > baseline : input.facts.growthHealthScore >= 80;
  }

  if (verification.expectedMetric === "Retention score") {
    const baseline = Number(input.payload.baselineRetentionScore ?? 0);
    return baseline > 0 ? input.facts.retention.retentionScore > baseline : input.facts.retention.retentionScore >= 55;
  }

  if (verification.expectedMetric === "Revenue growth rate") {
    const baseline = Number(input.payload.baselineRevenueGrowthRate ?? 0);
    return baseline > 0
      ? input.facts.scores.revenueGrowthRate > baseline
      : input.facts.scores.revenueGrowthRate >= 5;
  }

  if (verification.expectedMetric === "Average order value") {
    const baseline = Number(input.payload.baselineAov ?? 0);
    return baseline > 0 ? input.facts.scores.aov > baseline : input.facts.scores.aov >= 45;
  }

  return input.facts.growthHealthScore >= 70;
}
