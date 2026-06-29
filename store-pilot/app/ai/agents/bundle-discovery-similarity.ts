import type { BundleIntelligenceRecommendationDraft } from "../schemas/bundle-intelligence";
import { areBundlesSimilar } from "../tools/bundle-similarity-tool";

export function areBundleRecommendationsSimilar(
  left: Pick<BundleIntelligenceRecommendationDraft, "bundleProductIds">,
  right: Pick<BundleIntelligenceRecommendationDraft, "bundleProductIds">,
): boolean {
  return areBundlesSimilar(left.bundleProductIds, right.bundleProductIds);
}

export function dedupeSimilarBundleRecommendations<
  T extends BundleIntelligenceRecommendationDraft & { priorityScore?: number },
>(recommendations: T[]): T[] {
  const kept: T[] = [];

  for (const candidate of recommendations) {
    const duplicate = kept.find((existing) => areBundleRecommendationsSimilar(existing, candidate));
    if (!duplicate) {
      kept.push(candidate);
      continue;
    }

    const candidateScore = candidate.priorityScore ?? candidate.confidence * 100;
    const existingScore = duplicate.priorityScore ?? duplicate.confidence * 100;

    if (candidateScore > existingScore) {
      kept[kept.indexOf(duplicate)] = candidate;
    }
  }

  return kept;
}
