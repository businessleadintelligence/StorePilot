export function analyzeSeoImageOptimization(input: {
  missingAltTextProxy: number;
  totalProducts: number;
}): { score: number; issues: string[]; altTextCoverage: number } {
  const altTextCoverage =
    input.totalProducts <= 0
      ? 0
      : Math.round(((input.totalProducts - input.missingAltTextProxy) / input.totalProducts) * 100);
  const issues: string[] = [];
  if (altTextCoverage < 85) issues.push("images_missing_alt_text");
  return { score: altTextCoverage, issues, altTextCoverage };
}
