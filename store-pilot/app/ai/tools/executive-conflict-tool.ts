export type ExecutiveConflictItem = {
  id: string;
  title: string;
  agents: string[];
  recommendationIds: string[];
  reason: string;
  severity: "low" | "medium" | "high";
  resolution: string;
};

export function analyzeExecutiveConflicts(input: {
  collaborationConflicts: Array<{
    id: string;
    title: string;
    agents: string[];
    recommendations: string[];
    reason: string;
    severity: "low" | "medium" | "high";
    resolution: string;
  }>;
  competingPriorities: Array<{ id: string; category: string; priorityScore: number }>;
}): {
  conflicts: ExecutiveConflictItem[];
  conflictScore: number;
  highSeverityCount: number;
  issues: string[];
} {
  const issues: string[] = [];
  const conflicts: ExecutiveConflictItem[] = input.collaborationConflicts.map((conflict) => ({
    id: conflict.id,
    title: conflict.title,
    agents: conflict.agents,
    recommendationIds: conflict.recommendations,
    reason: conflict.reason,
    severity: conflict.severity,
    resolution: conflict.resolution,
  }));

  const categoryWinners = new Map<string, { id: string; score: number }>();
  for (const item of input.competingPriorities) {
    const current = categoryWinners.get(item.category);
    if (!current || item.priorityScore > current.score) {
      categoryWinners.set(item.category, { id: item.id, score: item.priorityScore });
    }
  }

  const grouped = new Map<string, typeof input.competingPriorities>();
  for (const item of input.competingPriorities) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  for (const [category, items] of grouped) {
    if (items.length < 2) continue;
    const sorted = [...items].sort((left, right) => right.priorityScore - left.priorityScore);
    const gap = sorted[0].priorityScore - sorted[1].priorityScore;
    if (gap < 8) {
      conflicts.push({
        id: `conflict-${category}`,
        title: `Competing ${category} priorities`,
        agents: [],
        recommendationIds: sorted.slice(0, 2).map((item) => item.id),
        reason: "Multiple high-priority actions compete for the same merchant focus.",
        severity: gap < 4 ? "high" : "medium",
        resolution: "Sequence actions and complete prerequisites before parallel work.",
      });
    }
  }

  const highSeverityCount = conflicts.filter((conflict) => conflict.severity === "high").length;
  const conflictScore = Math.max(
    0,
    Math.min(100, Math.round(conflicts.length * 12 + highSeverityCount * 18)),
  );

  if (highSeverityCount > 0) issues.push("high_severity_conflicts");
  if (conflicts.length >= 4) issues.push("conflict_load_high");

  return { conflicts, conflictScore, highSeverityCount, issues };
}
