export function calculateVelocity(sales30Days: number, windowDays = 30): number {
  if (windowDays <= 0) {
    return 0;
  }

  return Number((sales30Days / windowDays).toFixed(2));
}

export function calculateDaysRemaining(
  availableInventory: number | null,
  velocity: number,
): number | null {
  if (availableInventory === null || velocity <= 0) {
    return null;
  }

  return Math.max(0, Math.ceil(availableInventory / velocity));
}
