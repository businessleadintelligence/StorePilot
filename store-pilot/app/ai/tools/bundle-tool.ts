export type BundleCandidate = {
  productId: string;
  pairedProductId: string;
  coPurchaseCount: number;
  confidence: number;
};

export function rankBundleCandidates(
  pairs: Array<{ productId: string; pairedProductId: string; coPurchaseCount: number }>,
): BundleCandidate[] {
  const max = Math.max(1, ...pairs.map((pair) => pair.coPurchaseCount));

  return pairs
    .map((pair) => ({
      ...pair,
      confidence: Number((pair.coPurchaseCount / max).toFixed(2)),
    }))
    .sort((left, right) => right.coPurchaseCount - left.coPurchaseCount);
}
