export function bundleSimilarityKey(productIds: string[]): string {
  return [...productIds].sort().join(":");
}

export function areBundlesSimilar(leftProductIds: string[], rightProductIds: string[]): boolean {
  return bundleSimilarityKey(leftProductIds) === bundleSimilarityKey(rightProductIds);
}

export function dedupeBundleCandidates<T extends { productIds: string[]; confidence: number }>(
  candidates: T[],
): T[] {
  const kept = new Map<string, T>();

  for (const candidate of candidates) {
    const key = bundleSimilarityKey(candidate.productIds);
    const existing = kept.get(key);
    if (!existing || candidate.confidence > existing.confidence) {
      kept.set(key, candidate);
    }
  }

  return [...kept.values()];
}
