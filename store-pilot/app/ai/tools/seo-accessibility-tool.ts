export function analyzeSeoAccessibility(input: {
  missingAltTextProxy: number;
  headingOrderIssues: number;
  totalProducts: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (input.missingAltTextProxy > 0) issues.push("accessibility_missing_alt_text");
  if (input.headingOrderIssues > 0) issues.push("accessibility_heading_order");
  const altCoverage =
    input.totalProducts <= 0
      ? 100
      : Math.round(((input.totalProducts - input.missingAltTextProxy) / input.totalProducts) * 100);
  return {
    score: Math.max(0, Math.min(100, Math.round(altCoverage * 0.7 + (100 - input.headingOrderIssues * 10) * 0.3))),
    issues,
  };
}
