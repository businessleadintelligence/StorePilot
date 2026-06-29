export function analyzeSeoContent(input: {
  totalProducts: number;
  productsWithShortTitles: number;
  thinContentPages: number;
  missingCollectionDescriptions: number;
  collectionCount: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (input.productsWithShortTitles > 0) issues.push("content_short_titles");
  if (input.thinContentPages > 0) issues.push("content_thin_pages");
  if (input.missingCollectionDescriptions > 0) issues.push("content_collection_descriptions");
  let score = 70;
  score -= input.productsWithShortTitles * 4;
  score -= input.thinContentPages * 5;
  score -= input.missingCollectionDescriptions * 3;
  return { score: Math.max(0, Math.min(100, score)), issues };
}
