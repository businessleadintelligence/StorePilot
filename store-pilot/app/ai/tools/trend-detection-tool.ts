export type TrendDirection = "emerging" | "stable" | "declining" | "unknown";

export function detectTrendDirection(input: {
  sales7Days: number;
  sales30Days: number;
}): TrendDirection {
  if (input.sales30Days === 0 && input.sales7Days === 0) {
    return "unknown";
  }

  const normalizedWeekly = (input.sales30Days / 30) * 7;
  if (normalizedWeekly === 0) {
    return input.sales7Days > 0 ? "emerging" : "unknown";
  }

  const ratio = input.sales7Days / normalizedWeekly;
  if (ratio >= 1.15) return "emerging";
  if (ratio <= 0.85) return "declining";
  return "stable";
}

export function detectStoreTrendDirection(input: {
  revenue7Days: number;
  revenue30Days: number;
  emergingProductCount: number;
  decliningProductCount: number;
}): TrendDirection | "mixed" {
  const revenueDirection = detectTrendDirection({
    sales7Days: input.revenue7Days,
    sales30Days: input.revenue30Days,
  });

  if (input.emergingProductCount > 0 && input.decliningProductCount > 0) {
    return "mixed";
  }

  if (input.emergingProductCount >= input.decliningProductCount * 2) {
    return "emerging";
  }

  if (input.decliningProductCount >= input.emergingProductCount * 2) {
    return "declining";
  }

  return revenueDirection;
}
