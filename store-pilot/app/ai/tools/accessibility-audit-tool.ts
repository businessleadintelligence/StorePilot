export function auditAccessibility(input: {
  productsWithoutDescriptiveTitles: number;
  shortButtonLabels: number;
  headingOrderIssues: number;
  missingAltTextProxy: number;
  totalProducts: number;
}): { score: number; issues: string[]; altTextCoverage: number } {
  const issues: string[] = [];
  const altTextCoverage =
    input.totalProducts === 0
      ? 0
      : Math.round(
          ((input.totalProducts - input.missingAltTextProxy) / input.totalProducts) * 100,
        );

  if (input.missingAltTextProxy > 0) issues.push("accessibility_missing_alt_text");
  if (input.productsWithoutDescriptiveTitles > 0) issues.push("accessibility_weak_labels");
  if (input.shortButtonLabels > 0) issues.push("accessibility_short_button_labels");
  if (input.headingOrderIssues > 0) issues.push("accessibility_heading_order");
  if (altTextCoverage < 80) issues.push("accessibility_low_alt_coverage");

  let score = 70;
  score -= input.missingAltTextProxy * 4;
  score -= input.productsWithoutDescriptiveTitles * 3;
  score -= input.headingOrderIssues * 5;
  score += Math.round(altTextCoverage * 0.2);

  return { score: Math.max(0, Math.min(100, score)), issues, altTextCoverage };
}
