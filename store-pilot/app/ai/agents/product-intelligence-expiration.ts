import type { ProductFacts } from "../facts/product-facts";

export type RecommendationExpirationReason =
  | "inventory_restored"
  | "revenue_recovered"
  | "promotion_ended"
  | "stock_sold"
  | "bundle_created"
  | "issue_resolved";

export function getRecommendationExpirationReason(input: {
  facts: ProductFacts;
  payload: Record<string, unknown>;
}): RecommendationExpirationReason | null {
  const { facts, payload } = input;
  const category = String(payload.category ?? "");
  const verification = payload.verification as
    | { expectedMetric?: string; expectedDirection?: string }
    | undefined;

  if (category === "Inventory") {
    if (facts.stockRisk === "LOW" && facts.daysRemaining !== null && facts.daysRemaining >= 45) {
      return "inventory_restored";
    }

    if (facts.daysRemaining !== null && facts.daysRemaining <= 7 && facts.stockRisk === "CRITICAL") {
      return null;
    }

    if (facts.daysRemaining !== null && facts.daysRemaining > 120) {
      return "stock_sold";
    }
  }

  if (category === "Promotion" && facts.trend === "growing" && facts.sales7Days > facts.sales30Days / 4) {
    return "promotion_ended";
  }

  if (category === "Merchandising" && payload.id === "bundle-best-seller" && facts.trend === "growing") {
    return "bundle_created";
  }

  if (verification?.expectedMetric === "Inventory Days" && facts.daysRemaining !== null && facts.daysRemaining >= 30) {
    return "inventory_restored";
  }

  if (facts.trend === "growing" && facts.refundRate < 3 && category === "Revenue") {
    return "revenue_recovered";
  }

  if (facts.healthScore >= 80 && facts.stockRisk !== "CRITICAL" && facts.stockRisk !== "HIGH") {
    return "issue_resolved";
  }

  return null;
}

export function shouldExpireRecommendation(input: {
  facts: ProductFacts;
  payload: Record<string, unknown>;
  status: string;
}): boolean {
  if (input.status === "closed" || input.status === "verified") {
    return false;
  }

  return getRecommendationExpirationReason(input) !== null;
}
