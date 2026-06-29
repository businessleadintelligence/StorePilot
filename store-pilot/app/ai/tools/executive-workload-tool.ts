export type ExecutiveWorkloadItem = {
  id: string;
  title: string;
  status: string;
  estimatedMinutes: number;
  priorityScore: number;
};

export function analyzeExecutiveWorkload(input: {
  operations: ExecutiveWorkloadItem[];
  recommendations: Array<{ id: string; priorityScore: number }>;
  merchantCapacityScore: number;
}): {
  totalEstimatedMinutes: number;
  activeMinutes: number;
  backlogMinutes: number;
  workloadScore: number;
  overload: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const activeStatuses = new Set(["in_progress", "approved", "verification"]);
  const active = input.operations.filter((op) => activeStatuses.has(op.status));
  const backlog = input.operations.filter((op) => op.status === "pending" || op.status === "blocked");

  const activeMinutes = active.reduce((sum, op) => sum + op.estimatedMinutes, 0);
  const backlogMinutes = backlog.reduce((sum, op) => sum + op.estimatedMinutes, 0);
  const recommendationMinutes = input.recommendations.length * 30;
  const totalEstimatedMinutes = activeMinutes + backlogMinutes + recommendationMinutes;

  const capacityMinutes = Math.max(60, (input.merchantCapacityScore / 100) * 480);
  const loadRatio = totalEstimatedMinutes / capacityMinutes;
  const workloadScore = Math.max(0, Math.min(100, Math.round(100 - (loadRatio - 1) * 35)));
  const overload = loadRatio >= 1.35;

  if (overload) issues.push("workload_overload");
  if (backlog.length >= 6) issues.push("operations_backlog_high");

  return {
    totalEstimatedMinutes,
    activeMinutes,
    backlogMinutes,
    workloadScore,
    overload,
    issues,
  };
}
