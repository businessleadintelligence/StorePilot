import type { TrendEstimatedImpact } from "../schemas/trend-intelligence";

export function estimateTrendImpact(input: {
  category: string;
  confidence: number;
  momentum: number;
  sales30Days: number;
}): TrendEstimatedImpact {
  const base = Number((input.momentum * input.confidence * Math.max(1, input.sales30Days) * 0.05).toFixed(2));

  return {
    revenueOpportunity:
      input.category === "Emerging Opportunity" || input.category === "Category Momentum" ? base : null,
    unitsProtected: input.category === "Declining Demand" ? Math.round(base) : null,
    demandLift: input.category === "Product Momentum" ? Number((base / 10).toFixed(2)) : null,
    inventoryAlignment: input.category === "Inventory Alignment" ? Math.round(base / 2) : null,
  };
}

export function hasTrendDeterministicImpact(impact: TrendEstimatedImpact): boolean {
  return Object.values(impact).some((value) => value !== null && value !== undefined && value > 0);
}
