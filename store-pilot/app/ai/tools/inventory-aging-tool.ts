export function calculateInventoryAgingDays(input: {
  lastSaleAt: string | null;
  updatedAt: string;
  computedAt: string;
}): number {
  const reference = input.lastSaleAt ?? input.updatedAt;
  const deltaMs = Date.parse(input.computedAt) - Date.parse(reference);
  return Math.max(0, Math.ceil(deltaMs / 86_400_000));
}

export function classifyDeadStock(input: {
  agingDays: number;
  velocity: number;
  availableInventory: number | null;
  sales90Days: number;
}): boolean {
  if ((input.availableInventory ?? 0) <= 0) {
    return false;
  }

  if (input.sales90Days === 0 && input.agingDays >= 60) {
    return true;
  }

  return input.agingDays >= 90 && input.velocity < 0.15;
}

export function classifyInventoryAgeBand(agingDays: number): "fresh" | "aging" | "stale" | "dead" {
  if (agingDays < 30) {
    return "fresh";
  }

  if (agingDays < 60) {
    return "aging";
  }

  if (agingDays < 90) {
    return "stale";
  }

  return "dead";
}
