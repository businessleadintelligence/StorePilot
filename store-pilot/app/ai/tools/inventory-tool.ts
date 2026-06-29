export type StockRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

export type InventoryMetrics = {
  inventory: number | null;
  availableInventory: number | null;
  reservedInventory: number | null;
  stockRisk: StockRisk;
};

export function calculateStockRisk(input: {
  availableInventory: number | null;
  daysRemaining: number | null;
  velocity: number;
}): StockRisk {
  if (input.availableInventory === null) {
    return "UNKNOWN";
  }

  if (input.availableInventory <= 0) {
    return "CRITICAL";
  }

  if (input.daysRemaining === null) {
    return input.velocity > 0 ? "MEDIUM" : "LOW";
  }

  if (input.daysRemaining <= 7) {
    return "CRITICAL";
  }

  if (input.daysRemaining <= 14) {
    return "HIGH";
  }

  if (input.daysRemaining <= 30) {
    return "MEDIUM";
  }

  return "LOW";
}

export function buildInventoryMetrics(input: {
  inventory: number | null;
  reservedInventory?: number | null;
  daysRemaining: number | null;
  velocity: number;
}): InventoryMetrics {
  const reservedInventory = input.reservedInventory ?? 0;
  const availableInventory =
    input.inventory === null ? null : Math.max(0, input.inventory - reservedInventory);

  return {
    inventory: input.inventory,
    availableInventory,
    reservedInventory,
    stockRisk: calculateStockRisk({
      availableInventory,
      daysRemaining: input.daysRemaining,
      velocity: input.velocity,
    }),
  };
}
