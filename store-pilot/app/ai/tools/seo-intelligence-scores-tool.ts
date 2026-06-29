export type SeoIntelligenceScoreInput = {
  totalProducts: number;
  productsWithMetaTitle: number;
  productsWithMetaDescription: number;
  productsWithShortTitles: number;
  duplicateTitles: number;
  missingAltTextProxy: number;
  thinContentPages: number;
  collectionCount: number;
  missingCollectionDescriptions: number;
  internalLinkScoreProxy: number;
  structuredDataLikely: boolean;
  canonicalIssues: number;
  indexedPagesProxy: number;
  totalPagesProxy: number;
  headingOrderIssues: number;
  lcpScore: number;
  clsScore: number;
  inpScore: number;
  performanceScore: number;
  accessibilityScore: number;
  searchVisibilityProxy: number;
  averageCtrProxy: number;
  averagePositionProxy: number;
};

export type SeoIntelligenceScores = {
  seoScore: number;
  technicalSeoScore: number;
  contentScore: number;
  indexabilityScore: number;
  internalLinkingScore: number;
  structuredDataScore: number;
  coreWebVitalsScore: number;
  performanceScore: number;
  imageOptimizationScore: number;
  accessibilityScore: number;
  duplicateContentScore: number;
  canonicalHealth: number;
  headingStructureScore: number;
  searchVisibilityScore: number;
  organicOpportunityScore: number;
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function calculateSeoIntelligenceScores(input: SeoIntelligenceScoreInput): SeoIntelligenceScores {
  const metaTitleCoverage = pct(input.productsWithMetaTitle, input.totalProducts);
  const metaDescriptionCoverage = pct(input.productsWithMetaDescription, input.totalProducts);
  const altCoverage = pct(input.totalProducts - input.missingAltTextProxy, input.totalProducts);

  const contentScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        metaTitleCoverage * 0.25 +
          metaDescriptionCoverage * 0.2 +
          (100 - pct(input.productsWithShortTitles, Math.max(1, input.totalProducts))) * 0.2 +
          (100 - pct(input.thinContentPages, Math.max(1, input.totalProducts + input.collectionCount))) * 0.2 +
          (100 - pct(input.missingCollectionDescriptions, Math.max(1, input.collectionCount))) * 0.15,
      ) - input.duplicateTitles * 3,
    ),
  );

  const technicalSeoScore = Math.max(
    0,
    Math.min(
      100,
      70 -
        input.canonicalIssues * 8 -
        (input.structuredDataLikely ? 0 : 12) -
        input.headingOrderIssues * 4 +
        metaTitleCoverage * 0.1,
    ),
  );

  const indexabilityScore = Math.max(
    0,
    Math.min(100, pct(input.indexedPagesProxy, Math.max(1, input.totalPagesProxy)) - input.canonicalIssues * 5),
  );

  const internalLinkingScore = Math.max(0, Math.min(100, input.internalLinkScoreProxy));
  const structuredDataScore = input.structuredDataLikely ? 85 : 45;
  const coreWebVitalsScore = Math.round((input.lcpScore + input.clsScore + input.inpScore) / 3);
  const imageOptimizationScore = Math.max(0, Math.min(100, altCoverage - (input.missingAltTextProxy > 0 ? 5 : 0)));
  const duplicateContentScore = Math.max(0, Math.min(100, 100 - input.duplicateTitles * 12 - input.thinContentPages * 2));
  const canonicalHealth = Math.max(0, Math.min(100, 100 - input.canonicalIssues * 15));
  const headingStructureScore = Math.max(0, Math.min(100, 100 - input.headingOrderIssues * 10));
  const searchVisibilityScore = Math.max(0, Math.min(100, input.searchVisibilityProxy));
  const organicOpportunityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (100 - contentScore) * 0.25 +
          (100 - technicalSeoScore) * 0.2 +
          (100 - coreWebVitalsScore) * 0.15 +
          Math.max(0, 10 - input.averagePositionProxy) * 4 +
          (1 - input.averageCtrProxy) * 20,
      ),
    ),
  );

  const seoScore = Math.round(
    contentScore * 0.2 +
      technicalSeoScore * 0.15 +
      indexabilityScore * 0.1 +
      internalLinkingScore * 0.1 +
      structuredDataScore * 0.1 +
      coreWebVitalsScore * 0.1 +
      input.performanceScore * 0.05 +
      imageOptimizationScore * 0.05 +
      input.accessibilityScore * 0.05 +
      searchVisibilityScore * 0.1,
  );

  return {
    seoScore,
    technicalSeoScore,
    contentScore,
    indexabilityScore,
    internalLinkingScore,
    structuredDataScore,
    coreWebVitalsScore,
    performanceScore: input.performanceScore,
    imageOptimizationScore,
    accessibilityScore: input.accessibilityScore,
    duplicateContentScore,
    canonicalHealth,
    headingStructureScore,
    searchVisibilityScore,
    organicOpportunityScore,
  };
}

export function calculateSeoHealthScore(scores: SeoIntelligenceScores, issueCount: number): number {
  let score = scores.seoScore;
  score -= Math.min(issueCount, 12) * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}
