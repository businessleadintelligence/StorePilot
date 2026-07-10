import type { ExperimentBaselineMetrics, ExperimentContextBundle } from "../shared/types";

export function captureExperimentBaseline(
  context: ExperimentContextBundle,
): ExperimentBaselineMetrics {
  const revenueBaseline = context.merchantBaselines.find((b) => b.baselineType === "revenue");
  const pricingBaseline = context.merchantBaselines.find((b) => b.baselineType === "pricing");
  const inventoryBaseline = context.merchantBaselines.find((b) => b.baselineType === "inventory");
  const refundBaseline = context.merchantBaselines.find((b) => b.baselineType === "refund");

  const recentRevenue = Number(revenueBaseline?.baselineJson.recent30DayRevenue ?? 0);
  const aov = Number(revenueBaseline?.baselineJson.averageOrderValue ?? 75);
  const conversion = Number(revenueBaseline?.baselineJson.conversionRate ?? 0.025);
  const margin = Number(pricingBaseline?.baselineJson.averageMargin ?? 0.35);
  const inventoryValue = Number(inventoryBaseline?.baselineJson.totalInventoryValue ?? recentRevenue * 0.4);
  const refundRate = Number(refundBaseline?.baselineJson.refundRate ?? 0.02);
  const seoGaps = countEvidence(context, ["MissingSEO", "MissingMetaDescription"]);
  const seoScore = Math.max(0.1, 1 - seoGaps / 40);

  return {
    revenue: roundCurrency(recentRevenue > 0 ? recentRevenue : aov * 30),
    conversion: round(conversion),
    ctr: round(Math.max(0.01, 0.04 - seoGaps * 0.001)),
    inventory: roundCurrency(inventoryValue),
    traffic: roundCurrency(recentRevenue > 0 ? recentRevenue / Math.max(conversion, 0.01) : aov * 100),
    seoScore: round(seoScore),
    refunds: round(refundRate),
    aov: roundCurrency(aov),
    margin: round(margin),
  };
}

function countEvidence(
  context: ExperimentContextBundle,
  factTypes: string[],
): number {
  return factTypes.reduce(
    (sum, factType) => sum + (context.evidenceGroups.get(factType)?.count ?? 0),
    0,
  );
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
