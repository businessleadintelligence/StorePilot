export function auditProductPages(input: {
  totalProducts: number;
  shortTitles: number;
  missingPrice: number;
  missingSku: number;
  draftProducts: number;
  averageTitleLength: number;
}): { score: number; issues: string[]; imageCountScore: number; descriptionScore: number } {
  const issues: string[] = [];
  const imageCountScore = input.totalProducts > 0 ? Math.min(100, 50 + input.totalProducts * 2) : 20;
  const descriptionScore =
    input.averageTitleLength >= 30 ? 80 : input.averageTitleLength >= 20 ? 60 : 35;

  if (input.shortTitles > 0) issues.push("product_short_title");
  if (input.missingPrice > 0) issues.push("product_missing_price");
  if (input.missingSku > 0) issues.push("product_missing_sku");
  if (input.draftProducts > 0) issues.push("product_draft_published_gap");
  if (descriptionScore < 50) issues.push("product_weak_description");
  if (imageCountScore < 60) issues.push("product_insufficient_media");

  let score = 60;
  score -= input.shortTitles * 3;
  score -= input.missingPrice * 5;
  score -= input.missingSku * 2;
  score -= input.draftProducts * 4;
  score += Math.round(descriptionScore * 0.15);

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    imageCountScore,
    descriptionScore,
  };
}
