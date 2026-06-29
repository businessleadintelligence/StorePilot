export function calculateInventoryVelocity(sales30Days: number, windowDays = 30): number {
  if (windowDays <= 0) {
    return 0;
  }

  return Number((sales30Days / windowDays).toFixed(2));
}

export function calculateInventoryTurnover(input: {
  sales30Days: number;
  averageInventory: number | null;
}): number {
  if (!input.averageInventory || input.averageInventory <= 0) {
    return input.sales30Days > 0 ? Number((input.sales30Days / 30).toFixed(2)) : 0;
  }

  return Number((input.sales30Days / input.averageInventory).toFixed(2));
}

export function calculateDaysOfInventoryRemaining(
  availableInventory: number | null,
  velocity: number,
): number | null {
  if (availableInventory === null || velocity <= 0) {
    return null;
  }

  return Math.max(0, Math.ceil(availableInventory / velocity));
}
