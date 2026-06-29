export function analyzeSeoHeadingStructure(input: {
  headingOrderIssues: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (input.headingOrderIssues > 0) issues.push("heading_structure_issues");
  return {
    score: Math.max(0, 100 - input.headingOrderIssues * 12),
    issues,
  };
}
