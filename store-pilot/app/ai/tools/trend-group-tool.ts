import type { TrendIntelligenceGroup } from "../schemas/trend-intelligence";

export function assignTrendRecommendationGroup(input: {
  category: string;
  priorityScore: number;
  hasDeterministicImpact: boolean;
}): TrendIntelligenceGroup {
  if (input.category === "Seasonal Trend") {
    return "Seasonal Plays";
  }

  if (input.category === "Declining Demand") {
    return input.priorityScore >= 70 ? "Decline Mitigation" : "Long-Term Trend Strategy";
  }

  if (input.category === "Category Momentum" || input.category === "Emerging Opportunity") {
    return input.priorityScore >= 70 ? "Emerging Opportunities" : "Category Growth";
  }

  if (input.hasDeterministicImpact && input.priorityScore >= 55) {
    return "Emerging Opportunities";
  }

  return "Long-Term Trend Strategy";
}

export function buildTrendRecommendationGroups(
  recommendations: Array<{ id: string; group: TrendIntelligenceGroup }>,
) {
  return {
    emergingOpportunities: recommendations
      .filter((item) => item.group === "Emerging Opportunities")
      .map((item) => item.id),
    seasonalPlays: recommendations.filter((item) => item.group === "Seasonal Plays").map((item) => item.id),
    declineMitigation: recommendations
      .filter((item) => item.group === "Decline Mitigation")
      .map((item) => item.id),
    categoryGrowth: recommendations.filter((item) => item.group === "Category Growth").map((item) => item.id),
    longTermTrendStrategy: recommendations
      .filter((item) => item.group === "Long-Term Trend Strategy")
      .map((item) => item.id),
  };
}
