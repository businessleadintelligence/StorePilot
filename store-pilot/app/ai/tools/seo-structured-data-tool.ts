export function analyzeSeoStructuredData(input: {
  structuredDataLikely: boolean;
  totalProducts: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (!input.structuredDataLikely) issues.push("structured_data_missing");
  if (input.totalProducts >= 5 && !input.structuredDataLikely) issues.push("structured_data_product_gap");
  return {
    score: input.structuredDataLikely ? 88 : 42,
    issues,
  };
}
