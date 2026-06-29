import type { StockRisk } from "./inventory-tool";

export function calculateSafetyStock(velocity: number, leadTimeDays = 14): number {
  if (velocity <= 0) {
    return 0;
  }

  return Math.max(0, Math.ceil(velocity * leadTimeDays * 1.2));
}

export function calculateReorderUrgency(input: {
  daysRemaining: number | null;
  stockRisk: StockRisk;
  velocity: number;
}): number {
  if (input.stockRisk === "CRITICAL" || input.daysRemaining === 0) {
    return 1;
  }

  if (input.stockRisk === "HIGH" || (input.daysRemaining !== null && input.daysRemaining <= 7)) {
    return 2;
  }

  if (input.stockRisk === "MEDIUM" || (input.daysRemaining !== null && input.daysRemaining <= 14)) {
    return 3;
  }

  if (input.velocity > 0 && input.daysRemaining !== null && input.daysRemaining <= 30) {
    return 4;
  }

  return 5;
}

export function calculateEstimatedRunOutDate(input: {
  availableInventory: number | null;
  velocity: number;
  computedAt: string;
}): string | null {
  if (input.availableInventory === null || input.velocity <= 0) {
    return null;
  }

  const days = Math.ceil(input.availableInventory / input.velocity);
  return new Date(Date.parse(input.computedAt) + days * 86_400_000).toISOString();
}

export function buildReorderSuggestion(input: {
  productId: string;
  title: string;
  velocity: number;
  availableInventory: number | null;
  safetyStock: number;
  reorderUrgency: number;
}): {
  productId: string;
  title: string;
  suggestedQuantity: number;
  urgency: number;
} | null {
  if (input.velocity <= 0 || input.reorderUrgency >= 5) {
    return null;
  }

  const current = input.availableInventory ?? 0;
  const suggestedQuantity = Math.max(0, input.safetyStock - current + Math.ceil(input.velocity * 14));

  if (suggestedQuantity <= 0) {
    return null;
  }

  return {
    productId: input.productId,
    title: input.title,
    suggestedQuantity,
    urgency: input.reorderUrgency,
  };
}
