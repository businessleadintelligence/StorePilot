import type { PricingEstimatedImpact } from "../schemas/pricing-intelligence";

export function estimatePricingImpact(input: {
  category: string;
  confidence: number;
  sectionScore: number;
}): PricingEstimatedImpact {
  const lift = Number(((100 - input.sectionScore) * input.confidence * 0.2).toFixed(2));
  return {
    revenueIncrease: ["Revenue Optimization", "Conversion Pricing", "Bundle Pricing", "Premium Pricing"].includes(
      input.category,
    )
      ? lift
      : null,
    profitIncrease: ["Margin Protection", "Discount Optimization", "Loss Leader Strategy"].includes(input.category)
      ? lift
      : null,
    marginImprovement: ["Margin Protection", "Premium Pricing", "Discount Optimization"].includes(input.category)
      ? lift / 100
      : null,
    roi: input.category === "Bundle Pricing" ? lift / 100 : null,
  };
}

export function hasPricingDeterministicImpact(impact: PricingEstimatedImpact): boolean {
  return Object.values(impact).some((value) => value !== null && value !== undefined && value > 0);
}

export function estimatePricingRevenueGain(impact: PricingEstimatedImpact, sectionScore: number): number {
  return Math.round((100 - sectionScore) * 18 + (impact.revenueIncrease ?? 0) * 120);
}

export function estimatePricingProfitGain(impact: PricingEstimatedImpact, marginPercent: number): number {
  return Math.round((impact.profitIncrease ?? 0) * 90 + Math.max(0, 40 - marginPercent) * 8);
}
