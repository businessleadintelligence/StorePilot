import type { PricingIntelligenceGroup } from "../schemas/pricing-intelligence";

export function assignPricingRecommendationGroup(input: {
  category: string;
  priorityScore: number;
  hasDeterministicImpact: boolean;
}): PricingIntelligenceGroup {
  if (input.category === "Margin Protection" || input.category === "Loss Leader Strategy") {
    return input.priorityScore >= 70 ? "Critical Pricing Risks" : "Margin Protection";
  }

  if (input.category === "Premium Pricing") {
    return "Premium Pricing";
  }

  if (input.category === "Discount Optimization" || input.category === "Markdown Timing") {
    return "Discount Optimization";
  }

  if (input.category === "Inventory Pricing") {
    return "Inventory Pricing";
  }

  if (input.category === "Bundle Pricing") {
    return "Bundle Pricing";
  }

  if (input.priorityScore >= 75) {
    return "Critical Pricing Risks";
  }

  if (input.hasDeterministicImpact && input.priorityScore >= 55) {
    return "Quick Revenue Wins";
  }

  if (input.priorityScore < 50) {
    return "Long-Term Pricing Strategy";
  }

  return "Quick Revenue Wins";
}

export function buildPricingRecommendationGroups(
  recommendations: Array<{ id: string; group: PricingIntelligenceGroup }>,
) {
  return {
    criticalPricingRisks: recommendations
      .filter((item) => item.group === "Critical Pricing Risks")
      .map((item) => item.id),
    marginProtection: recommendations
      .filter((item) => item.group === "Margin Protection")
      .map((item) => item.id),
    quickRevenueWins: recommendations.filter((item) => item.group === "Quick Revenue Wins").map((item) => item.id),
    premiumPricing: recommendations.filter((item) => item.group === "Premium Pricing").map((item) => item.id),
    discountOptimization: recommendations
      .filter((item) => item.group === "Discount Optimization")
      .map((item) => item.id),
    inventoryPricing: recommendations.filter((item) => item.group === "Inventory Pricing").map((item) => item.id),
    bundlePricing: recommendations.filter((item) => item.group === "Bundle Pricing").map((item) => item.id),
    longTermPricingStrategy: recommendations
      .filter((item) => item.group === "Long-Term Pricing Strategy")
      .map((item) => item.id),
  };
}
