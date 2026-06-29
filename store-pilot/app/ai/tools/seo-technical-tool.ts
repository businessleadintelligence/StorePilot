import type { SeoEstimatedImpact } from "../schemas/seo-intelligence";

export function analyzeTechnicalSeo(input: {
  duplicateTitles: number;
  canonicalIssues: number;
  structuredDataLikely: boolean;
  headingOrderIssues: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (input.duplicateTitles > 0) issues.push("technical_duplicate_titles");
  if (input.canonicalIssues > 0) issues.push("technical_canonical_conflict");
  if (!input.structuredDataLikely) issues.push("technical_structured_data_missing");
  if (input.headingOrderIssues > 0) issues.push("technical_heading_structure");
  let score = 75 - input.duplicateTitles * 5 - input.canonicalIssues * 10 - input.headingOrderIssues * 4;
  if (!input.structuredDataLikely) score -= 10;
  return { score: Math.max(0, Math.min(100, score)), issues };
}
