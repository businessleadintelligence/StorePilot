export function calculateRefundRate(refundCount: number, ordersCount: number): number {
  if (ordersCount <= 0) {
    return 0;
  }

  return Number(((refundCount / ordersCount) * 100).toFixed(2));
}

export type RefundMetrics = {
  refundCount30Days: number;
  refundRate: number;
};

export function buildRefundMetrics(input: {
  refundCount30Days: number;
  orders30Days: number;
}): RefundMetrics {
  return {
    refundCount30Days: input.refundCount30Days,
    refundRate: calculateRefundRate(input.refundCount30Days, input.orders30Days),
  };
}
