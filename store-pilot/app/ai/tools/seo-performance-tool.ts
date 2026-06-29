export function analyzeSeoPerformance(input: {
  syncLatencyDays: number | null;
  webhookCount: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 78;
  if (input.webhookCount > 8) {
    issues.push("performance_script_bloat");
    score -= 10;
  }
  if (input.syncLatencyDays !== null && input.syncLatencyDays > 7) {
    issues.push("performance_stale_sync");
    score -= 8;
  }
  return { score: Math.max(0, Math.min(100, score)), issues };
}
