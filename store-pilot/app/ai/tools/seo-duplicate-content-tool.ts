export function analyzeSeoDuplicateContent(input: {
  duplicateTitles: number;
  thinContentPages: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (input.duplicateTitles > 0) issues.push("duplicate_titles");
  if (input.thinContentPages > 0) issues.push("duplicate_thin_content");
  return {
    score: Math.max(0, 100 - input.duplicateTitles * 12 - input.thinContentPages * 4),
    issues,
  };
}
