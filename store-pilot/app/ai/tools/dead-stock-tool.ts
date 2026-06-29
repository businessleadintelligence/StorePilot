export type DeadStockClassification = {
  isDeadStock: boolean;
  agingDays: number;
  tiedUpUnits: number;
  reason: string | null;
};

export function classifyDeadInventory(input: {
  agingDays: number;
  velocity: number;
  availableInventory: number | null;
  sales90Days: number;
}): DeadStockClassification {
  const tiedUpUnits = Math.max(0, input.availableInventory ?? 0);

  if (tiedUpUnits <= 0) {
    return { isDeadStock: false, agingDays: input.agingDays, tiedUpUnits: 0, reason: null };
  }

  if (input.sales90Days === 0 && input.agingDays >= 60) {
    return {
      isDeadStock: true,
      agingDays: input.agingDays,
      tiedUpUnits,
      reason: "No sales in 90 days with inventory on hand",
    };
  }

  if (input.agingDays >= 90 && input.velocity < 0.15) {
    return {
      isDeadStock: true,
      agingDays: input.agingDays,
      tiedUpUnits,
      reason: "Very low velocity with aged inventory",
    };
  }

  return { isDeadStock: false, agingDays: input.agingDays, tiedUpUnits, reason: null };
}
