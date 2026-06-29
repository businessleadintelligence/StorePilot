import type { MerchantLearningProfile, OperationPriority, StoreOperation } from "./operations-types";

const PRIORITY_WEIGHT: Record<OperationPriority, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

export function calculateOperationPriorityScore(input: {
  priority: OperationPriority;
  expectedRevenueImpact: number;
  expectedInventoryImpact: number;
  difficulty: string;
  dueAt: string | null;
  blocked: boolean;
  learning?: MerchantLearningProfile;
  category?: string;
}): number {
  const revenueBoost = Math.min(30, input.expectedRevenueImpact / 1000);
  const inventoryBoost = Math.min(15, input.expectedInventoryImpact / 500);
  const difficultyPenalty = input.difficulty.toLowerCase() === "hard" ? 10 : input.difficulty.toLowerCase() === "easy" ? -5 : 0;
  const deadlineBoost =
    input.dueAt && new Date(input.dueAt).getTime() - Date.now() < 48 * 60 * 60 * 1000 ? 20 : 0;
  const blockedPenalty = input.blocked ? -25 : 0;
  const learningBoost =
    input.learning && input.category && input.learning.fastCategories.includes(input.category) ? 8 : 0;
  const learningPenalty =
    input.learning && input.category && input.learning.delayedCategories.includes(input.category) ? -8 : 0;

  return Number(
    (
      PRIORITY_WEIGHT[input.priority] +
      revenueBoost +
      inventoryBoost +
      deadlineBoost +
      blockedPenalty +
      learningBoost +
      learningPenalty -
      difficultyPenalty
    ).toFixed(2),
  );
}

export function rankOperationsQueue(operations: StoreOperation[]): StoreOperation[] {
  return [...operations].sort(
    (left, right) =>
      right.priorityScore - left.priorityScore ||
      left.estimatedRemainingMinutes - right.estimatedRemainingMinutes ||
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export function mapNumericPriority(priority: OperationPriority): number {
  switch (priority) {
    case "critical":
      return 1;
    case "high":
      return 2;
    case "medium":
      return 3;
    default:
      return 4;
  }
}

export function inferPriorityFromSource(input: {
  priority?: number | string;
  risk?: string;
}): OperationPriority {
  if (input.risk === "high" || input.priority === 1 || input.priority === "critical") return "critical";
  if (input.priority === 2 || input.priority === "high") return "high";
  if (input.priority === 4 || input.priority === "low") return "low";
  return "medium";
}
