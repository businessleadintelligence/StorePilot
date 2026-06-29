export function analyzeCollectionGrowth(input: {
  collectionCount: number;
  activeProducts: number;
  productsPerCollection: number;
  thinCollectionCount: number;
  missingCollectionDescriptions: number;
}): { collectionGrowthScore: number; expansionCandidates: number; issues: string[] } {
  const issues: string[] = [];
  const coverageRatio =
    input.collectionCount <= 0 ? 0 : input.activeProducts / Math.max(1, input.collectionCount);
  const collectionGrowthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.min(100, coverageRatio * 8) * 0.35 +
          Math.min(100, input.productsPerCollection * 12) * 0.25 +
          Math.max(0, 100 - input.thinCollectionCount * 12) * 0.25 +
          Math.max(0, 100 - input.missingCollectionDescriptions * 8) * 0.15,
      ),
    ),
  );
  const expansionCandidates = Math.max(0, input.thinCollectionCount + Math.floor(input.activeProducts / 12));

  if (input.thinCollectionCount > 0) issues.push("thin_collections_limit_discovery");
  if (input.missingCollectionDescriptions > 0) issues.push("collection_merchandising_gap");
  if (collectionGrowthScore >= 60) issues.push("collection_expansion_ready");

  return { collectionGrowthScore, expansionCandidates, issues };
}
