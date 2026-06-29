import type { SalesTrend } from "./trend-tool";
import type { StockRisk } from "./inventory-tool";

export function calculateProductHealthScore(input: {
  stockRisk: StockRisk;
  trend: SalesTrend;
  refundRate: number;
  sales30Days: number;
  margin: number | null;
}): number {
  let score = 72;

  switch (input.stockRisk) {
    case "CRITICAL":
      score -= 28;
      break;
    case "HIGH":
      score -= 18;
      break;
    case "MEDIUM":
      score -= 8;
      break;
    case "LOW":
      score += 4;
      break;
    case "UNKNOWN":
      score -= 4;
      break;
  }

  switch (input.trend) {
    case "growing":
      score += 12;
      break;
    case "stable":
      score += 2;
      break;
    case "declining":
      score -= 14;
      break;
    case "unknown":
      score -= 6;
      break;
  }

  if (input.refundRate >= 10) {
    score -= 18;
  } else if (input.refundRate >= 5) {
    score -= 10;
  } else if (input.refundRate >= 2) {
    score -= 4;
  } else {
    score += 4;
  }

  if (input.sales30Days <= 0) {
    score -= 20;
  } else if (input.sales30Days < 5) {
    score -= 10;
  } else if (input.sales30Days >= 30) {
    score += 8;
  }

  if (input.margin !== null) {
    if (input.margin >= 40) {
      score += 6;
    } else if (input.margin < 15) {
      score -= 8;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
