import type { TrendFacts } from "../facts/trend-facts";

export function shouldExpireTrendRecommendation(input: {
  facts: TrendFacts;
  payload: Record<string, unknown>;
  status: string;
}): boolean {
  if (!["open", "viewed", "implemented"].includes(input.status)) return false;
  const category = String(input.payload.category ?? "");
  const baselineSales = Number(input.payload.baselineSales30Days ?? 0);
  const productId = String(input.payload.productId ?? "");

  if (category === "Declining Demand" && productId) {
    const product = input.facts.products.find((entry) => entry.productId === productId);
    return product?.direction === "stable" || product?.direction === "emerging";
  }

  if (category === "Emerging Opportunity" && baselineSales > 0) {
    const product = input.facts.products.find((entry) => entry.productId === productId);
    return Boolean(product && product.sales30Days >= baselineSales * 1.2);
  }

  return input.facts.rollingDecline.decliningProductCount === 0 && category === "Declining Demand";
}

export function getTrendRecommendationExpirationReason(input: {
  facts: TrendFacts;
  payload: Record<string, unknown>;
}): string | null {
  const category = String(input.payload.category ?? "");
  if (category === "Declining Demand") return "decline_resolved";
  if (category === "Emerging Opportunity") return "trend_materialized";
  return "issue_resolved";
}

export function getTrendRecommendationVerificationReason(input: {
  facts: TrendFacts;
  payload: Record<string, unknown>;
}): boolean {
  const verification = input.payload.verification as
    | { expectedMetric?: string; expectedDirection?: string }
    | undefined;
  if (!verification?.expectedMetric) return false;

  const productId = String(input.payload.productId ?? "");
  const product = productId
    ? input.facts.products.find((entry) => entry.productId === productId)
    : undefined;
  const baselineSales = Number(input.payload.baselineSales30Days ?? 0);

  if (verification.expectedMetric === "Product sales") {
    return baselineSales > 0 && Boolean(product && product.sales30Days > baselineSales);
  }

  if (verification.expectedMetric === "Store revenue") {
    const baseline = Number(input.payload.baselineRevenue30Days ?? 0);
    return baseline > 0 ? input.facts.revenueTrend.revenue30Days > baseline : input.facts.revenueTrend.growthRate > 0;
  }

  return input.facts.trendHealthScore >= 70;
}
