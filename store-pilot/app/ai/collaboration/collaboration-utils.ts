import type { CollaborationSourceAgent } from "./collaboration-types";

export function buildCollaborationSubjectKey(storeId: string): string {
  return `collaboration:${storeId}`;
}

export function parseProductIdFromSubjectKey(subjectKey: string): string | null {
  const match = subjectKey.match(/^product:(.+)$/);
  return match?.[1] ?? null;
}

export function normalizeRecommendationTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractProductTokens(title: string): string[] {
  return normalizeRecommendationTitle(title)
    .split(" ")
    .filter((token) => token.length > 3);
}

export function recommendationsShareProduct(
  left: { title: string; productId: string | null; productTitle: string | null },
  right: { title: string; productId: string | null; productTitle: string | null },
): boolean {
  if (left.productId && right.productId && left.productId === right.productId) {
    return true;
  }

  const leftTokens = new Set(extractProductTokens(`${left.productTitle ?? ""} ${left.title}`));
  const rightTokens = extractProductTokens(`${right.productTitle ?? ""} ${right.title}`);
  return rightTokens.filter((token) => leftTokens.has(token)).length >= 1;
}

export function areRecommendationsSimilar(
  left: { title: string; category: string },
  right: { title: string; category: string },
): boolean {
  if (left.category !== right.category) {
    return false;
  }

  const leftNorm = normalizeRecommendationTitle(left.title);
  const rightNorm = normalizeRecommendationTitle(right.title);
  if (leftNorm === rightNorm) {
    return true;
  }

  const leftTokens = new Set(leftNorm.split(" "));
  const rightTokens = rightNorm.split(" ").filter((token) => leftTokens.has(token));
  return rightTokens.length >= Math.min(3, leftTokens.size);
}

export function isInventoryIncreaseAction(recommendation: {
  title: string;
  category: string;
  merchantAction: string[];
}): boolean {
  const haystack = `${recommendation.title} ${recommendation.category} ${recommendation.merchantAction.join(" ")}`.toLowerCase();
  return /reorder|restock|increase inventory|purchase order|replenish/.test(haystack);
}

export function isInventoryDecreaseAction(recommendation: {
  title: string;
  category: string;
  merchantAction: string[];
}): boolean {
  const haystack = `${recommendation.title} ${recommendation.category} ${recommendation.merchantAction.join(" ")}`.toLowerCase();
  return /reduce purchasing|liquidat|discount|clearance|dead stock|overstock|markdown/.test(haystack);
}

export function isEmergingTrendAction(recommendation: {
  title: string;
  category: string;
  reason: string;
}): boolean {
  const haystack = `${recommendation.title} ${recommendation.category} ${recommendation.reason}`.toLowerCase();
  return /emerging|accelerating|increasing demand|growth|momentum/.test(haystack);
}

export function isDecliningTrendAction(recommendation: {
  title: string;
  category: string;
  reason: string;
}): boolean {
  const haystack = `${recommendation.title} ${recommendation.category} ${recommendation.reason}`.toLowerCase();
  return /declining|slowing|collapse|dead stock|excess inventory/.test(haystack);
}

export function agentLabel(agentId: CollaborationSourceAgent): string {
  const labels: Record<CollaborationSourceAgent, string> = {
    product_intelligence: "Product Intelligence",
    inventory_intelligence: "Inventory Intelligence",
    bundle_discovery: "Bundle Discovery",
    store_audit: "Store Audit",
    trend_intelligence: "Trend Intelligence",
    seo_audit: "SEO Intelligence",
    pricing_intelligence: "Pricing Intelligence",
    growth_intelligence: "Revenue Growth Intelligence",
  };
  return labels[agentId];
}

export function difficultyWeight(difficulty: string): number {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return 1;
    case "medium":
      return 2;
    case "hard":
      return 3;
    default:
      return 2;
  }
}
