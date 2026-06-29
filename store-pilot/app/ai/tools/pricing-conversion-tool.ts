export function analyzePricingConversion(input: {
  conversionRate: number;
  averageDiscountPercent: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (input.conversionRate < 0.02) issues.push("conversion_pricing_friction");
  if (input.averageDiscountPercent > 20 && input.conversionRate < 0.03) {
    issues.push("discount_not_fixing_conversion");
  }
  const score = Math.max(
    0,
    Math.min(100, Math.round(input.conversionRate * 2000 - input.averageDiscountPercent * 0.5)),
  );
  return { score, issues };
}
