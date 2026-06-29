import type { InventoryIntelligenceGroup } from "../schemas/inventory-intelligence";

export function assignInventoryRecommendationGroup(input: {
  category: string;
  priorityScore: number;
  hasDeterministicImpact: boolean;
  stockoutAlertCount: number;
}): InventoryIntelligenceGroup {
  if (input.category === "Stockout" || (input.stockoutAlertCount > 0 && input.category === "Reorder")) {
    return "Critical Inventory Risks";
  }

  if (input.category === "Reorder" || input.category === "Supplier") {
    return "Immediate Reorders";
  }

  if (
    input.hasDeterministicImpact &&
    (input.category === "Dead Inventory" ||
      input.category === "Clearance" ||
      input.category === "Overstock")
  ) {
    return "Cash Flow Opportunities";
  }

  if (input.category === "Warehouse" || input.category === "Operational") {
    return "Warehouse Optimizations";
  }

  if (input.priorityScore < 50) {
    return "Long-Term Planning";
  }

  return "Warehouse Optimizations";
}

export function buildInventoryRecommendationGroups(
  recommendations: Array<{ id: string; group: InventoryIntelligenceGroup }>,
) {
  return {
    criticalInventoryRisks: recommendations
      .filter((item) => item.group === "Critical Inventory Risks")
      .map((item) => item.id),
    immediateReorders: recommendations
      .filter((item) => item.group === "Immediate Reorders")
      .map((item) => item.id),
    cashFlowOpportunities: recommendations
      .filter((item) => item.group === "Cash Flow Opportunities")
      .map((item) => item.id),
    warehouseOptimizations: recommendations
      .filter((item) => item.group === "Warehouse Optimizations")
      .map((item) => item.id),
    longTermPlanning: recommendations
      .filter((item) => item.group === "Long-Term Planning")
      .map((item) => item.id),
  };
}
