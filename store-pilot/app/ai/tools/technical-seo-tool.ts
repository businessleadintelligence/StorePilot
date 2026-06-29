export function analyzeTechnicalSeo(input: {
  duplicateTitles: number;
  missingSku: number;
  totalProducts: number;
  structuredDataLikely: boolean;
  webhookCount: number;
}): {
  score: number;
  issues: string[];
  canonicalRisk: boolean;
  sitemapLikely: boolean;
  structuredDataLikely: boolean;
} {
  const issues: string[] = [];
  const canonicalRisk = input.missingSku > 0 || input.duplicateTitles > 0;
  const sitemapLikely = input.totalProducts >= 3;
  const structuredDataLikely = input.structuredDataLikely;

  if (canonicalRisk) issues.push("technical_seo_canonical_risk");
  if (!sitemapLikely) issues.push("technical_seo_sitemap_gap");
  if (!structuredDataLikely) issues.push("technical_seo_structured_data_missing");
  if (input.webhookCount > 10) issues.push("technical_seo_crawl_noise_risk");

  let score = 70;
  if (canonicalRisk) score -= 12;
  if (!structuredDataLikely) score -= 10;
  if (!sitemapLikely) score -= 8;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    canonicalRisk,
    sitemapLikely,
    structuredDataLikely,
  };
}
