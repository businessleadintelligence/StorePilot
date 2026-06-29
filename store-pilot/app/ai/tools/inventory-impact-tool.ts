import type { InventoryEstimatedImpact } from "../schemas/inventory-intelligence";
import type { InventoryIntelligenceCategory } from "../schemas/inventory-intelligence";

export function estimateInventoryRecommendationImpact(input: {
  category: InventoryIntelligenceCategory;
  velocity: number;
  availableInventory: number | null;
  daysRemaining: number | null;
  safetyStock: number;
  tiedUpUnits: number;
  unitCost?: number | null;
}): InventoryEstimatedImpact {
  const impact: InventoryEstimatedImpact = {};
  const unitCost = input.unitCost ?? 10;

  switch (input.category) {
    case "Stockout":
    case "Reorder": {
      if (input.velocity > 0) {
        impact.ordersProtected = Math.max(1, Math.round(input.velocity * 14));
        impact.inventoryDaysSaved = input.daysRemaining === null ? 14 : Math.max(0, 14 - input.daysRemaining);
      }
      break;
    }
    case "Overstock":
    case "Dead Inventory":
    case "Clearance": {
      if (input.tiedUpUnits > 0) {
        impact.inventoryCostSaved = Math.round(input.tiedUpUnits * unitCost * 0.15);
      }
      break;
    }
    case "Warehouse":
    case "Operational": {
      if ((input.availableInventory ?? 0) > input.safetyStock * 2) {
        impact.inventoryDaysSaved = Math.max(0, (input.daysRemaining ?? 0) - 45);
      }
      break;
    }
    default:
      break;
  }

  return impact;
}

export function hasInventoryDeterministicImpact(impact: InventoryEstimatedImpact): boolean {
  return Object.values(impact).some((value) => value !== null && value !== undefined && value > 0);
}

export function summarizeInventoryImpact(
  impact: InventoryEstimatedImpact,
  category: InventoryIntelligenceCategory,
): string {
  if (impact.ordersProtected) {
    return `Protect about ${impact.ordersProtected} orders from stockouts`;
  }

  if (impact.inventoryCostSaved) {
    return `Free about $${impact.inventoryCostSaved.toLocaleString()} in tied-up inventory cost`;
  }

  if (impact.inventoryDaysSaved) {
    return `Improve inventory coverage by about ${impact.inventoryDaysSaved} days`;
  }

  return `Improve ${category.toLowerCase()} performance using current inventory signals`;
}
