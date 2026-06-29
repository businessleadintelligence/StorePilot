import type { StockRisk } from "./inventory-tool";

export type InventoryHealthInput = {
  stockoutAlertCount: number;
  deadStockCount: number;
  overstockCount: number;
  understockCount: number;
  totalProducts: number;
  averageDaysRemaining: number | null;
  averageTurnover: number;
};

export function calculateInventoryHealthScore(input: InventoryHealthInput): number {
  if (input.totalProducts <= 0) {
    return 50;
  }

  let score = 100;
  const ratio = (count: number) => count / input.totalProducts;

  score -= ratio(input.stockoutAlertCount) * 35;
  score -= ratio(input.deadStockCount) * 25;
  score -= ratio(input.overstockCount) * 12;
  score -= ratio(input.understockCount) * 10;

  if (input.averageDaysRemaining !== null && input.averageDaysRemaining < 14) {
    score -= 8;
  }

  if (input.averageTurnover < 0.5) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyInventoryHealthBand(score: number): "healthy" | "watch" | "at_risk" | "critical" {
  if (score >= 80) {
    return "healthy";
  }

  if (score >= 65) {
    return "watch";
  }

  if (score >= 45) {
    return "at_risk";
  }

  return "critical";
}

export function isStockoutRisk(stockRisk: StockRisk): boolean {
  return stockRisk === "CRITICAL" || stockRisk === "HIGH";
}
