export type ExecutiveEstimatedImpact = {
  revenueImpact: number;
  profitImpact: number;
  conversionLift: number | null;
  inventoryImpact: number | null;
  ordersProtected: number | null;
};

export function estimateExecutiveRevenueImpact(input: {
  baseRevenue30: number;
  revenueOpportunity: number;
  priorityScore: number;
  confidence: number;
}): number {
  const liftPercent = Math.min(25, input.revenueOpportunity / 8 + input.priorityScore * 0.08);
  return Math.round(input.baseRevenue30 * (liftPercent / 100) * input.confidence);
}

export function estimateExecutiveProfitImpact(input: {
  revenueImpact: number;
  marginPercent: number;
  profitOpportunity: number;
  priorityScore: number;
}): number {
  const marginLift = input.revenueImpact * (input.marginPercent / 100);
  const opportunityLift = input.profitOpportunity * (input.priorityScore / 100) * 0.35;
  return Math.round(marginLift + opportunityLift);
}

export function estimateExecutiveImpact(input: {
  baseRevenue30: number;
  marginPercent: number;
  revenueOpportunity: number;
  profitOpportunity: number;
  priorityScore: number;
  confidence: number;
  conversionLift?: number;
  inventoryImpact?: number;
  ordersProtected?: number;
}): ExecutiveEstimatedImpact {
  const revenueImpact = estimateExecutiveRevenueImpact({
    baseRevenue30: input.baseRevenue30,
    revenueOpportunity: input.revenueOpportunity,
    priorityScore: input.priorityScore,
    confidence: input.confidence,
  });
  const profitImpact = estimateExecutiveProfitImpact({
    revenueImpact,
    marginPercent: input.marginPercent,
    profitOpportunity: input.profitOpportunity,
    priorityScore: input.priorityScore,
  });

  return {
    revenueImpact,
    profitImpact,
    conversionLift: input.conversionLift ?? null,
    inventoryImpact: input.inventoryImpact ?? null,
    ordersProtected: input.ordersProtected ?? null,
  };
}
