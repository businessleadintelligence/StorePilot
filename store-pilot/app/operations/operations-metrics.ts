import type { MerchantLearningProfile, OperationsMetrics, StoreOperation } from "./operations-types";

export function calculateOperationsMetrics(operations: StoreOperation[]): OperationsMetrics {
  const total = operations.length;
  const started = operations.filter((operation) =>
    ["in_progress", "paused", "blocked", "verification", "completed", "verified"].includes(operation.status),
  ).length;
  const completed = operations.filter((operation) =>
    ["completed", "verified"].includes(operation.status),
  ).length;
  const verified = operations.filter((operation) => operation.status === "verified").length;
  const verificationAttempts = operations.filter((operation) =>
    ["verification", "completed", "verified"].includes(operation.status),
  ).length;

  const completionDurations = operations
    .filter((operation) => operation.startedAt && operation.completedAt)
    .map(
      (operation) =>
        (new Date(operation.completedAt!).getTime() - new Date(operation.startedAt!).getTime()) / 60000,
    );

  const averageCompletionMinutes =
    completionDurations.length > 0
      ? completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length
      : 0;

  return {
    executionRate: total > 0 ? Number((started / total).toFixed(2)) : 0,
    completionRate: total > 0 ? Number((completed / total).toFixed(2)) : 0,
    verificationSuccessRate:
      verificationAttempts > 0 ? Number((verified / verificationAttempts).toFixed(2)) : 0,
    averageCompletionMinutes: Number(averageCompletionMinutes.toFixed(2)),
    revenueGenerated: operations.reduce((sum, operation) => sum + operation.expectedRevenueImpact, 0),
    inventoryReduced: operations.reduce((sum, operation) => sum + operation.expectedInventoryImpact, 0),
    merchantProductivity:
      total > 0 ? Number(((completed + verified * 0.5) / total).toFixed(2)) : 0,
  };
}

export function updateMerchantLearningProfile(input: {
  learning: MerchantLearningProfile;
  operation: StoreOperation;
  completionMinutes: number;
}): MerchantLearningProfile {
  const category = input.operation.templateId;
  const fastCategories = new Set(input.learning.fastCategories);
  const delayedCategories = new Set(input.learning.delayedCategories);

  if (input.completionMinutes <= input.operation.estimatedMinutes) {
    fastCategories.add(category);
    delayedCategories.delete(category);
  } else if (input.completionMinutes > input.operation.estimatedMinutes * 1.5) {
    delayedCategories.add(category);
  }

  const completedAt = input.operation.completedAt ? new Date(input.operation.completedAt) : new Date();
  const prefersEvenings = completedAt.getHours() >= 17 ? true : input.learning.prefersEvenings;
  const ignoresWeekends = [0, 6].includes(completedAt.getDay()) ? false : input.learning.ignoresWeekends;

  return {
    fastCategories: [...fastCategories],
    delayedCategories: [...delayedCategories],
    preferredBatchSize: Math.min(5, Math.max(1, input.learning.preferredBatchSize)),
    prefersEvenings,
    ignoresWeekends,
    averageCompletionMinutes: Number(
      (
        (input.learning.averageCompletionMinutes + input.completionMinutes) /
        2
      ).toFixed(2),
    ),
  };
}

export function buildAchievements(metrics: OperationsMetrics): string[] {
  const achievements: string[] = [];
  if (metrics.completionRate >= 0.8) achievements.push("Execution Streak");
  if (metrics.verificationSuccessRate >= 0.75) achievements.push("Verification Pro");
  if (metrics.revenueGenerated >= 10000) achievements.push("Revenue Operator");
  if (metrics.averageCompletionMinutes > 0 && metrics.averageCompletionMinutes <= 45) {
    achievements.push("Fast Executor");
  }
  return achievements;
}

export function buildOperationsCharts(operations: StoreOperation[], metrics: OperationsMetrics) {
  const openTasks = operations.reduce(
    (sum, operation) => sum + operation.tasks.filter((task) => !task.completed).length,
    0,
  );
  const completedTasks = operations.reduce(
    (sum, operation) => sum + operation.tasks.filter((task) => task.completed).length,
    0,
  );

  return {
    burnDown: [
      { label: "Remaining", value: openTasks },
      { label: "Completed", value: completedTasks },
    ],
    completionVelocity: operations.slice(0, 7).map((operation, index) => ({
      label: `Op ${index + 1}`,
      value: operation.progressPercent,
    })),
    verificationFunnel: [
      { label: "Queued", value: operations.filter((operation) => operation.status === "verification").length },
      { label: "Completed", value: operations.filter((operation) => operation.status === "completed").length },
      { label: "Verified", value: operations.filter((operation) => operation.status === "verified").length },
    ],
    executionHeatmap: operations.map((operation) => ({
      label: operation.title.slice(0, 12),
      value: operation.progressPercent,
    })),
    kanbanFlow: [
      { label: "Planned", value: operations.filter((operation) => operation.kanbanColumn === "planned").length },
      { label: "Approved", value: operations.filter((operation) => operation.kanbanColumn === "approved").length },
      { label: "In Progress", value: operations.filter((operation) => operation.kanbanColumn === "in_progress").length },
      { label: "Blocked", value: operations.filter((operation) => operation.kanbanColumn === "blocked").length },
      { label: "Verification", value: operations.filter((operation) => operation.kanbanColumn === "verification").length },
      { label: "Completed", value: operations.filter((operation) => operation.kanbanColumn === "completed").length },
    ],
    revenueDelivered: operations.map((operation) => ({
      label: operation.title.slice(0, 12),
      value: operation.expectedRevenueImpact,
    })),
    timeAllocation: operations.map((operation) => ({
      label: operation.templateId,
      value: operation.estimatedMinutes,
    })),
    productivityTrend: [
      { label: "Execution", value: Math.round(metrics.executionRate * 100) },
      { label: "Completion", value: Math.round(metrics.completionRate * 100) },
      { label: "Verification", value: Math.round(metrics.verificationSuccessRate * 100) },
    ],
    capacityGauge: [
      { label: "Capacity Used", value: Math.min(100, operations.filter((operation) => operation.status === "in_progress").length * 20) },
      { label: "Available", value: Math.max(0, 100 - operations.filter((operation) => operation.status === "in_progress").length * 20) },
    ],
    weeklyProgress: operations.slice(0, 5).map((operation, index) => ({
      label: `W${index + 1}`,
      value: operation.progressPercent,
    })),
  };
}
