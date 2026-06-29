import type { StockRisk } from "./inventory-tool";

export type InventoryRiskLevel = "low" | "medium" | "high" | "critical";

export function scoreStockoutRisk(stockRisk: StockRisk): number {
  switch (stockRisk) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    default:
      return 1;
  }
}

export function calculateInventoryRiskScore(input: {
  stockRisk: StockRisk;
  overstockRisk: boolean;
  understockRisk: boolean;
  deadStock: boolean;
  agingDays: number;
}): number {
  let score = scoreStockoutRisk(input.stockRisk) * 20;
  if (input.overstockRisk) {
    score += 15;
  }
  if (input.understockRisk) {
    score += 20;
  }
  if (input.deadStock) {
    score += 25;
  }
  if (input.agingDays >= 90) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

export function classifyInventoryRiskLevel(score: number): InventoryRiskLevel {
  if (score >= 75) {
    return "critical";
  }

  if (score >= 50) {
    return "high";
  }

  if (score >= 25) {
    return "medium";
  }

  return "low";
}

export function buildInventoryRiskDistribution(input: {
  stockoutCount: number;
  overstockCount: number;
  deadStockCount: number;
  understockCount: number;
}): Array<{ label: string; value: number }> {
  return [
    { label: "Stockout", value: input.stockoutCount },
    { label: "Overstock", value: input.overstockCount },
    { label: "Dead Stock", value: input.deadStockCount },
    { label: "Understock", value: input.understockCount },
  ];
}
