import type { BundleFacts } from "../facts/bundle-facts";

export type BundleRecommendationExpirationReason =
  | "bundle_implemented"
  | "inventory_cleared"
  | "attach_rate_normalized"
  | "issue_resolved";

export function getBundleRecommendationExpirationReason(input: {
  facts: BundleFacts;
  payload: Record<string, unknown>;
}): BundleRecommendationExpirationReason | null {
  const { facts, payload } = input;
  const productIds = Array.isArray(payload.bundleProductIds)
    ? payload.bundleProductIds.map(String)
    : [];

  if (productIds.length >= 2) {
    const key = [...productIds].sort().join(":");
    const implemented = facts.implementedBundleIds.some((id) => id.includes(key));
    if (implemented) {
      return "bundle_implemented";
    }
  }

  if (
    payload.category === "Dead Inventory Bundle" &&
    facts.deadInventoryPairCount === 0 &&
    facts.potentialInventoryReduction === 0
  ) {
    return "inventory_cleared";
  }

  if (facts.bundleHealthScore >= 85 && facts.highConfidenceCount === 0) {
    return "attach_rate_normalized";
  }

  if (facts.candidateCount === 0 && facts.bundleHealthScore >= 80) {
    return "issue_resolved";
  }

  return null;
}

export function shouldExpireBundleRecommendation(input: {
  facts: BundleFacts;
  payload: Record<string, unknown>;
  status: string;
}): boolean {
  if (input.status === "closed" || input.status === "verified") {
    return false;
  }

  return getBundleRecommendationExpirationReason(input) !== null;
}
