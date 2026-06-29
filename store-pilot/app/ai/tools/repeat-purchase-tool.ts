export function analyzeRepeatPurchases(input: {
  repeatProductCount: number;
  totalProductsSold: number;
  repeatOrderCount: number;
  totalOrders: number;
}): { repeatPurchaseRate: number; score: number; issues: string[] } {
  const issues: string[] = [];
  const repeatPurchaseRate =
    input.totalProductsSold <= 0
      ? 0
      : Math.round((input.repeatProductCount / input.totalProductsSold) * 100);
  const repeatOrderRate =
    input.totalOrders <= 0 ? 0 : Math.round((input.repeatOrderCount / input.totalOrders) * 100);

  if (repeatPurchaseRate < 15) issues.push("weak_repeat_purchase_signal");
  if (repeatOrderRate < 20) issues.push("low_repeat_order_rate");
  if (repeatPurchaseRate >= 35) issues.push("strong_repeat_purchase_base");

  const score = Math.max(
    0,
    Math.min(100, Math.round(repeatPurchaseRate * 0.55 + repeatOrderRate * 0.45)),
  );

  return { repeatPurchaseRate, score, issues };
}
