export type SalesTrend = "declining" | "stable" | "growing" | "unknown";

export function calculateTrend(sales7Days: number, sales30Days: number): SalesTrend {
  const weeklyRate = sales7Days;
  const normalizedMonthlyRate = (sales30Days / 30) * 7;

  if (sales30Days === 0 && sales7Days === 0) {
    return "unknown";
  }

  if (normalizedMonthlyRate === 0) {
    return weeklyRate > 0 ? "growing" : "unknown";
  }

  const ratio = weeklyRate / normalizedMonthlyRate;

  if (ratio >= 1.15) {
    return "growing";
  }

  if (ratio <= 0.85) {
    return "declining";
  }

  return "stable";
}
