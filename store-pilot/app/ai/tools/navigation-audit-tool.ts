export function auditNavigation(input: {
  collectionCount: number;
  activeProductCount: number;
  duplicateCollectionTitles: number;
  productsMissingSku: number;
}): { score: number; issues: string[]; menuDepth: number; searchAvailable: boolean; footerComplete: boolean } {
  const issues: string[] = [];
  const menuDepth = input.collectionCount <= 5 ? 2 : input.collectionCount <= 12 ? 3 : 4;
  const searchAvailable = input.activeProductCount >= 5;
  const footerComplete = input.collectionCount >= 2;
  const breadcrumbsLikely = input.collectionCount >= 3;

  if (menuDepth > 3) issues.push("navigation_menu_too_deep");
  if (!searchAvailable) issues.push("navigation_search_unavailable");
  if (!footerComplete) issues.push("navigation_footer_incomplete");
  if (input.duplicateCollectionTitles > 0) issues.push("navigation_duplicate_collections");
  if (!breadcrumbsLikely) issues.push("navigation_missing_breadcrumbs");
  if (input.productsMissingSku > 0) issues.push("navigation_internal_linking_gaps");

  let score = 55;
  if (searchAvailable) score += 15;
  if (footerComplete) score += 10;
  if (menuDepth <= 3) score += 10;
  if (input.duplicateCollectionTitles === 0) score += 5;
  if (breadcrumbsLikely) score += 5;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    menuDepth,
    searchAvailable,
    footerComplete,
  };
}
