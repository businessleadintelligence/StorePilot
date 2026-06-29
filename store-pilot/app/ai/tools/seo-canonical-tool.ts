export function analyzeSeoCanonicalHealth(input: {
  duplicateTitles: number;
  missingSku: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  const canonicalIssues = input.duplicateTitles + (input.missingSku > 0 ? 1 : 0);
  if (input.duplicateTitles > 0) issues.push("canonical_duplicate_titles");
  if (input.missingSku > 0) issues.push("canonical_sku_gaps");
  return {
    score: Math.max(0, 100 - canonicalIssues * 15),
    issues,
  };
}
