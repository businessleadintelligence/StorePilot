import type { PricingIntelligenceFacts } from "../facts/pricing-intelligence-facts";

export type PricingRecommendationExpirationReason =
  | "margin_improved"
  | "discount_dependence_reduced"
  | "premium_opportunity_realized"
  | "inventory_pricing_normalized"
  | "issue_resolved";

export function shouldExpirePricingRecommendation(input: {
  facts: PricingIntelligenceFacts;
  payload: Record<string, unknown>;
  status: string;
}): boolean {
  if (!["open", "viewed", "implemented"].includes(input.status)) {
    return false;
  }

  const category = String(input.payload.category ?? "");
  const baselineScore = Number(input.payload.baselineSectionScore ?? 0);

  if (
    category === "Discount Optimization" &&
    baselineScore > 0 &&
    input.facts.discount.score >= baselineScore + 10
  ) {
    return true;
  }

  if (
    category === "Margin Protection" &&
    baselineScore > 0 &&
    input.facts.margin.marginPercent >= baselineScore + 5
  ) {
    return true;
  }

  if (
    category === "Premium Pricing" &&
    input.facts.strategySignals.premiumCandidates === 0 &&
    input.facts.premium.opportunityCount === 0
  ) {
    return true;
  }

  if (
    category === "Inventory Pricing" &&
    input.facts.inventory.inventoryRisk <= 25 &&
    input.facts.inventory.issues.length === 0
  ) {
    return true;
  }

  if (
    input.facts.pricingHealthScore >= 85 &&
    input.facts.criticalIssueCount === 0 &&
    category !== "Premium Pricing"
  ) {
    return true;
  }

  return false;
}

export function getPricingRecommendationExpirationReason(input: {
  facts: PricingIntelligenceFacts;
  payload: Record<string, unknown>;
}): PricingRecommendationExpirationReason | null {
  const category = String(input.payload.category ?? "");

  if (category === "Margin Protection") {
    return "margin_improved";
  }

  if (category === "Discount Optimization" || category === "Markdown Timing") {
    return "discount_dependence_reduced";
  }

  if (category === "Premium Pricing") {
    return "premium_opportunity_realized";
  }

  if (category === "Inventory Pricing") {
    return "inventory_pricing_normalized";
  }

  return "issue_resolved";
}

export function getPricingRecommendationVerificationReason(input: {
  facts: PricingIntelligenceFacts;
  payload: Record<string, unknown>;
}): boolean {
  const verification = input.payload.verification as
    | { expectedMetric?: string; expectedDirection?: string }
    | undefined;

  if (!verification?.expectedMetric) {
    return false;
  }

  if (verification.expectedMetric === "Pricing health score") {
    const baseline = Number(input.payload.baselinePricingHealthScore ?? 0);
    return baseline > 0 ? input.facts.pricingHealthScore > baseline : input.facts.pricingHealthScore >= 80;
  }

  if (verification.expectedMetric === "Margin percent") {
    const baseline = Number(input.payload.baselineMarginPercent ?? 0);
    return baseline > 0 ? input.facts.margin.marginPercent > baseline : input.facts.margin.marginPercent >= 40;
  }

  if (verification.expectedMetric === "Discount dependence") {
    const baseline = Number(input.payload.baselineDiscountDependence ?? 100);
    return input.facts.discount.discountDependence < baseline;
  }

  if (verification.expectedMetric === "Average order value") {
    const baseline = Number(input.payload.baselineAov ?? 0);
    return baseline > 0 ? input.facts.scores.aov > baseline : input.facts.scores.aov >= 35;
  }

  return input.facts.pricingHealthScore >= 70;
}
