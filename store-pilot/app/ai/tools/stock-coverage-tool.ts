export function calculateWeeksOfCover(daysRemaining: number | null): number | null {
  if (daysRemaining === null) {
    return null;
  }

  return Number((daysRemaining / 7).toFixed(1));
}

export function calculateAverageWeeksOfCover(daysRemainingValues: Array<number | null>): number | null {
  const values = daysRemainingValues.filter((value): value is number => value !== null);
  if (values.length === 0) {
    return null;
  }

  const averageDays = values.reduce((total, value) => total + value, 0) / values.length;
  return calculateWeeksOfCover(averageDays);
}

export function classifyStockCoverageBand(weeksOfCover: number | null): "critical" | "watch" | "healthy" {
  if (weeksOfCover === null) {
    return "watch";
  }

  if (weeksOfCover <= 2) {
    return "critical";
  }

  if (weeksOfCover <= 6) {
    return "watch";
  }

  return "healthy";
}

export function buildWeeksOfCoverDistribution(
  products: Array<{ title: string; daysRemaining: number | null }>,
): Array<{ label: string; value: number }> {
  return products
    .filter((product) => product.daysRemaining !== null)
    .slice(0, 8)
    .map((product) => ({
      label: product.title.slice(0, 16),
      value: calculateWeeksOfCover(product.daysRemaining) ?? 0,
    }));
}
