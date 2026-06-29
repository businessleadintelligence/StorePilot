export function auditCollections(input: {
  collectionCount: number;
  emptyCollections: number;
  missingDescriptions: number;
  duplicateCollections: number;
  missingImages: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (input.emptyCollections > 0) issues.push("collection_empty");
  if (input.missingDescriptions > 0) issues.push("collection_missing_description");
  if (input.duplicateCollections > 0) issues.push("collection_duplicate");
  if (input.missingImages > 0) issues.push("collection_missing_image");
  if (input.collectionCount < 2) issues.push("collection_insufficient_structure");

  let score = 70;
  score -= input.emptyCollections * 8;
  score -= input.missingDescriptions * 4;
  score -= input.duplicateCollections * 6;
  score -= input.missingImages * 5;

  return { score: Math.max(0, Math.min(100, score)), issues };
}
