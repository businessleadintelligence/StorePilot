export function analyzeSeoIndexability(input: {
  indexedPagesProxy: number;
  totalPagesProxy: number;
  canonicalIssues: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  const coverage =
    input.totalPagesProxy <= 0 ? 0 : Math.round((input.indexedPagesProxy / input.totalPagesProxy) * 100);
  if (coverage < 80) issues.push("indexability_low_coverage");
  if (input.canonicalIssues > 0) issues.push("indexability_canonical_blockers");
  return {
    score: Math.max(0, Math.min(100, coverage - input.canonicalIssues * 8)),
    issues,
  };
}
