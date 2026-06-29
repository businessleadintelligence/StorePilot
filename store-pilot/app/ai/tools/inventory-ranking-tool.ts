import type { InventoryEstimatedImpact } from "../schemas/inventory-intelligence";

const DIFFICULTY_WEIGHT = {
  Easy: 1,
  Medium: 0.75,
  Hard: 0.5,
} as const;

export function inventoryImpactScore(impact: InventoryEstimatedImpact): number {
  return (
    (impact.ordersProtected ?? 0) * 4 +
    (impact.inventoryCostSaved ?? 0) / 25 +
    (impact.inventoryDaysSaved ?? 0) * 2 +
    (impact.unitsRecovered ?? 0)
  );
}

export function calculateInventoryPriorityScore(input: {
  confidence: number;
  difficulty: keyof typeof DIFFICULTY_WEIGHT;
  impact: InventoryEstimatedImpact;
  stockoutAlertCount?: number;
  deadStockCount?: number;
  dismissedCategory?: boolean;
  ignoredCategory?: boolean;
}): number {
  let score = input.confidence * 100;
  score += inventoryImpactScore(input.impact);
  score *= DIFFICULTY_WEIGHT[input.difficulty];
  score += (input.stockoutAlertCount ?? 0) * 3;
  score += (input.deadStockCount ?? 0) * 2;

  if (input.dismissedCategory) {
    score -= 15;
  }

  if (input.ignoredCategory) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankInventoryPriorityScores<T extends { priorityScore: number; confidence: number }>(
  items: T[],
): T[] {
  return [...items].sort(
    (left, right) => right.priorityScore - left.priorityScore || right.confidence - left.confidence,
  );
}

export function deriveInventoryOverallPriorityFromScores(scores: number[]): number {
  const top = scores[0] ?? 0;
  if (top >= 85) {
    return 1;
  }

  if (top >= 70) {
    return 2;
  }

  if (top >= 50) {
    return 3;
  }

  return 4;
}
