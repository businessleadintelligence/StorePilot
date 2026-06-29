import type { BundleFacts } from "../facts/bundle-facts";
import type {
  BundleEstimatedImpact,
  BundleIntelligenceRecommendationDraft,
} from "../schemas/bundle-intelligence";
import { estimateBundleImpact, hasBundleDeterministicImpact } from "../tools/bundle-impact-tool";

function findCandidate(facts: BundleFacts, recommendationId: string) {
  return (
    facts.bundleCandidates.find((candidate) => candidate.id === recommendationId) ??
    facts.bundleCandidates[0]
  );
}

export function estimateBundleRecommendationImpactForFacts(
  facts: BundleFacts,
  recommendation: Pick<BundleIntelligenceRecommendationDraft, "id" | "bundleProductIds">,
): BundleEstimatedImpact {
  const candidate = findCandidate(facts, recommendation.id);

  if (!candidate) {
    return {};
  }

  const combinedPrice = recommendation.bundleProductIds.reduce((total, productId) => {
    const product = facts.products.find((item) => item.productId === productId);
    return total + (product?.price ?? 0);
  }, 0);

  return estimateBundleImpact({
    bundleConfidence: candidate.confidence,
    attachRate: candidate.attachRate,
    inventoryReduction: candidate.expectedInventoryReduction,
    combinedPrice,
  });
}

export { hasBundleDeterministicImpact };
