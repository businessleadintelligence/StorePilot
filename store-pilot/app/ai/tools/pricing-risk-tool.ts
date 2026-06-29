export function analyzePricingRisk(input: {
  revenueRisk: number;
  profitRisk: number;
  inventoryRisk: number;
  discountDependence: number;
}): { score: number; issues: string[] } {
  const composite = Math.round(
    input.revenueRisk * 0.3 +
      input.profitRisk * 0.35 +
      input.inventoryRisk * 0.2 +
      input.discountDependence * 0.15,
  );
  const issues: string[] = [];
  if (composite >= 60) issues.push("pricing_risk_elevated");
  if (input.discountDependence >= 55) issues.push("discount_dependence_risk");
  return { score: Math.max(0, Math.min(100, composite)), issues };
}

export function analyzePriceConsistency(input: {
  prices: number[];
}): { priceConsistencyScore: number; issues: string[] } {
  if (input.prices.length <= 1) {
    return { priceConsistencyScore: 100, issues: [] };
  }
  const sorted = [...input.prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const deviations = input.prices.filter(
    (price) => median > 0 && Math.abs(price - median) / median > 0.45,
  ).length;
  const issues: string[] = [];
  if (deviations > 0) issues.push("price_consistency_gap");
  return {
    priceConsistencyScore: Math.max(0, 100 - Math.round((deviations / input.prices.length) * 100)),
    issues,
  };
}
