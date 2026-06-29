import type { OperationTask, StoreOperation } from "./operations-types";

export function calculateOperationProgress(tasks: OperationTask[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => task.completed).length;
  return Math.round((completed / tasks.length) * 100);
}

export function estimateRemainingMinutes(operation: StoreOperation): number {
  const remainingTasks = operation.tasks.filter((task) => !task.completed).length;
  if (remainingTasks === 0) return 0;
  const perTask = Math.max(5, Math.round(operation.estimatedMinutes / Math.max(operation.tasks.length, 1)));
  return remainingTasks * perTask;
}

export function applyTaskProgress(operation: StoreOperation, taskId: string, completed: boolean): StoreOperation {
  const tasks = operation.tasks.map((task) =>
    task.id === taskId
      ? { ...task, completed, completedAt: completed ? new Date().toISOString() : null }
      : task,
  );
  const progressPercent = calculateOperationProgress(tasks);
  return {
    ...operation,
    tasks,
    progressPercent,
    estimatedRemainingMinutes: estimateRemainingMinutes({ ...operation, tasks }),
    updatedAt: new Date().toISOString(),
  };
}

export function refreshOperationProgress(operation: StoreOperation): StoreOperation {
  const progressPercent = calculateOperationProgress(operation.tasks);
  return {
    ...operation,
    progressPercent,
    estimatedRemainingMinutes: estimateRemainingMinutes(operation),
  };
}
