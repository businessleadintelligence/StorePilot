export function auditSeo(input: {
  productsWithShortTitles: number;
  productsWithLongTitles: number;
  totalProducts: number;
  duplicateTitles: number;
  missingSku: number;
}): {
  score: number;
  issues: string[];
  titleCoverage: number;
  descriptionCoverage: number;
  headingHierarchyScore: number;
  structuredDataLikely: boolean;
} {
  const issues: string[] = [];
  const titleCoverage =
    input.totalProducts === 0
      ? 0
      : Math.round(
          ((input.totalProducts - input.productsWithShortTitles) / input.totalProducts) * 100,
        );
  const descriptionCoverage = Math.min(
    100,
    Math.round((input.productsWithLongTitles / Math.max(1, input.totalProducts)) * 100),
  );
  const headingHierarchyScore = input.duplicateTitles === 0 ? 80 : 50;
  const structuredDataLikely = input.totalProducts >= 5 && input.duplicateTitles === 0;

  if (input.productsWithShortTitles > 0) issues.push("seo_short_titles");
  if (input.duplicateTitles > 0) issues.push("seo_duplicate_titles");
  if (descriptionCoverage < 60) issues.push("seo_missing_descriptions");
  if (!structuredDataLikely) issues.push("seo_structured_data_gap");
  if (input.missingSku > 0) issues.push("seo_canonical_sitemap_risk");

  let score = 60;
  score += Math.round(titleCoverage * 0.2);
  score += Math.round(descriptionCoverage * 0.15);
  score -= input.duplicateTitles * 5;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    titleCoverage,
    descriptionCoverage,
    headingHierarchyScore,
    structuredDataLikely,
  };
}
