export function analyzePricingDiscount(input: {
  averageDiscountPercent: number;
  discountFrequency: number;
  discountedOrderCount: number;
  totalOrders: number;
}): { score: number; discountDependence: number; issues: string[] } {
  const issues: string[] = [];
  if (input.averageDiscountPercent > 20) issues.push("discount_depth_high");
  if (input.discountFrequency > 45) issues.push("discount_frequency_high");
  if (input.discountFrequency > 65) issues.push("discount_abuse_risk");
  const discountDependence = Math.round(input.discountFrequency);
  const score = Math.max(0, Math.min(100, 100 - input.averageDiscountPercent - discountDependence * 0.35));
  return { score, discountDependence, issues };
}
