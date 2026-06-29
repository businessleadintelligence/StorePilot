import type { StockRisk } from "./inventory-tool";

export type StockoutPrediction = {
  stockoutRisk: StockRisk;
  predictedStockoutDate: string | null;
  daysUntilStockout: number | null;
};

export function predictStockoutDate(input: {
  availableInventory: number | null;
  velocity: number;
  computedAt: string;
}): StockoutPrediction {
  if (input.availableInventory === null || input.availableInventory <= 0) {
    return {
      stockoutRisk: "CRITICAL",
      predictedStockoutDate: input.computedAt,
      daysUntilStockout: 0,
    };
  }

  if (input.velocity <= 0) {
    return {
      stockoutRisk: "LOW",
      predictedStockoutDate: null,
      daysUntilStockout: null,
    };
  }

  const daysUntilStockout = Math.max(0, Math.ceil(input.availableInventory / input.velocity));
  const stockoutDate = new Date(Date.parse(input.computedAt) + daysUntilStockout * 86_400_000);

  let stockoutRisk: StockRisk = "LOW";
  if (daysUntilStockout <= 7) {
    stockoutRisk = "CRITICAL";
  } else if (daysUntilStockout <= 14) {
    stockoutRisk = "HIGH";
  } else if (daysUntilStockout <= 30) {
    stockoutRisk = "MEDIUM";
  }

  return {
    stockoutRisk,
    predictedStockoutDate: stockoutDate.toISOString(),
    daysUntilStockout,
  };
}

export function calculateUnderstockRisk(input: {
  daysRemaining: number | null;
  stockRisk: StockRisk;
}): boolean {
  if (input.stockRisk === "CRITICAL" || input.stockRisk === "HIGH") {
    return true;
  }

  return input.daysRemaining !== null && input.daysRemaining <= 21;
}

export function calculateOverstockRisk(input: {
  daysRemaining: number | null;
  velocity: number;
  availableInventory: number | null;
}): boolean {
  if (input.availableInventory !== null && input.availableInventory > 0 && input.velocity <= 0) {
    return true;
  }

  return input.daysRemaining !== null && input.daysRemaining >= 120;
}
