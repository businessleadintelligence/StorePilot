import type { GrowthEstimatedImpact } from "../schemas/growth-intelligence";

export function estimateGrowthImpact(input: {
  category: string;
  confidence: number;
  sectionScore: number;
}): GrowthEstimatedImpact {
  const lift = Number(((100 - input.sectionScore) * input.confidence * 0.22).toFixed(2));
  return {
    revenueIncrease: ["Revenue Growth", "AOV Growth", "Upsell", "Cross-sell", "Campaigns"].includes(input.category)
      ? lift
      : null,
    profitIncrease: ["Customer Lifetime Value", "Retention", "Repeat Purchases", "Merchandising"].includes(
      input.category,
    )
      ? lift
      : null,
    aovLift: ["AOV Growth", "Upsell", "Cross-sell"].includes(input.category) ? lift / 100 : null,
    retentionLift: ["Retention", "Repeat Purchases", "Customer Lifetime Value"].includes(input.category)
      ? lift / 100
      : null,
  };
}

export function hasGrowthDeterministicImpact(impact: GrowthEstimatedImpact): boolean {
  return Object.values(impact).some((value) => value !== null && value !== undefined && value > 0);
}

export function estimateGrowthRevenueGain(impact: GrowthEstimatedImpact, sectionScore: number): number {
  return Math.round((100 - sectionScore) * 16 + (impact.revenueIncrease ?? 0) * 110);
}

export function estimateGrowthProfitGain(impact: GrowthEstimatedImpact, retentionScore: number): number {
  return Math.round((impact.profitIncrease ?? 0) * 85 + Math.max(0, 60 - retentionScore) * 6);
}

export function estimateGrowthAovLift(impact: GrowthEstimatedImpact, aovScore: number): number {
  return Math.round(((impact.aovLift ?? 0) * 100 + Math.max(0, 65 - aovScore) * 0.4) * 10) / 10;
}

export function estimateGrowthRetentionLift(impact: GrowthEstimatedImpact, retentionScore: number): number {
  return Math.round(((impact.retentionLift ?? 0) * 100 + Math.max(0, 60 - retentionScore) * 0.5) * 10) / 10;
}
