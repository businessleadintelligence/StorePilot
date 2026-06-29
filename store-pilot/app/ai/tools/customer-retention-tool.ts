export function analyzeCustomerRetention(input: {
  returningCustomerRate: number;
  refundRate: number;
  repeatPurchaseRate: number;
}): { retentionScore: number; issues: string[] } {
  const issues: string[] = [];
  let retentionScore = Math.round(
    input.returningCustomerRate * 0.5 + input.repeatPurchaseRate * 0.35 + Math.max(0, 100 - input.refundRate * 4) * 0.15,
  );

  if (input.returningCustomerRate < 25) issues.push("low_returning_customer_rate");
  if (input.refundRate > 8) issues.push("refund_pressure_on_retention");
  if (retentionScore >= 70) issues.push("healthy_retention_base");

  retentionScore = Math.max(0, Math.min(100, retentionScore));
  return { retentionScore, issues };
}
