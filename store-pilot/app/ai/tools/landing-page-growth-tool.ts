export function analyzeLandingPageGrowth(input: {
  storeAuditScore: number;
  conversionIssueCount: number;
  mobileUxIssueCount: number;
  homepageIssueCount: number;
  productPageIssueCount: number;
}): { landingPageGrowthScore: number; fixCount: number; issues: string[] } {
  const issues: string[] = [];
  const penalty =
    input.conversionIssueCount * 6 +
    input.mobileUxIssueCount * 5 +
    input.homepageIssueCount * 4 +
    input.productPageIssueCount * 3;
  const landingPageGrowthScore = Math.max(0, Math.min(100, Math.round(input.storeAuditScore - penalty * 0.35)));
  const fixCount =
    input.conversionIssueCount +
    input.mobileUxIssueCount +
    input.homepageIssueCount +
    input.productPageIssueCount;

  if (input.conversionIssueCount > 0) issues.push("conversion_friction_on_landing_pages");
  if (input.mobileUxIssueCount > 0) issues.push("mobile_landing_page_gap");
  if (landingPageGrowthScore < 55) issues.push("landing_page_growth_blocked");

  return { landingPageGrowthScore, fixCount, issues };
}
