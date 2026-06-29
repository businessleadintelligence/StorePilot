import type { InventoryFacts } from "../facts/inventory-facts";

export type InventoryRecommendationExpirationReason =
  | "stockout_resolved"
  | "dead_stock_cleared"
  | "overstock_normalized"
  | "reorder_completed"
  | "issue_resolved";

export function getInventoryRecommendationExpirationReason(input: {
  facts: InventoryFacts;
  payload: Record<string, unknown>;
}): InventoryRecommendationExpirationReason | null {
  const { facts, payload } = input;
  const category = String(payload.category ?? "");

  if (category === "Stockout" || category === "Reorder") {
    if (facts.stockoutAlertCount === 0) {
      return "stockout_resolved";
    }
  }

  if (category === "Dead Inventory" || category === "Clearance") {
    if (facts.deadStockCount === 0) {
      return "dead_stock_cleared";
    }
  }

  if (category === "Overstock") {
    if (facts.overstockCount === 0) {
      return "overstock_normalized";
    }
  }

  if (category === "Supplier" && facts.reorderSuggestions.length === 0) {
    return "reorder_completed";
  }

  if (facts.inventoryHealthScore >= 80 && facts.stockoutAlertCount === 0 && facts.deadStockCount === 0) {
    return "issue_resolved";
  }

  return null;
}

export function shouldExpireInventoryRecommendation(input: {
  facts: InventoryFacts;
  payload: Record<string, unknown>;
  status: string;
}): boolean {
  if (input.status === "closed" || input.status === "verified") {
    return false;
  }

  return getInventoryRecommendationExpirationReason(input) !== null;
}
