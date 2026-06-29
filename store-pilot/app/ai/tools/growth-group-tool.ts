import type { GrowthIntelligenceGroup } from "../schemas/growth-intelligence";

export function assignGrowthRecommendationGroup(input: {
  category: string;
  priorityScore: number;
  hasDeterministicImpact: boolean;
}): GrowthIntelligenceGroup {
  if (input.category === "AOV Growth" || input.category === "Upsell" || input.category === "Cross-sell") {
    return input.priorityScore >= 70 ? "Immediate Revenue Wins" : "AOV Growth";
  }

  if (input.category === "Retention") {
    return "Retention";
  }

  if (input.category === "Repeat Purchases") {
    return "Repeat Purchases";
  }

  if (input.category === "Collections") {
    return "Collections";
  }

  if (input.category === "Campaigns") {
    return "Campaigns";
  }

  if (input.category === "Merchandising") {
    return "Merchandising";
  }

  if (input.category === "Seasonal Growth") {
    return "Seasonal Growth";
  }

  if (input.category === "Landing Pages") {
    return input.priorityScore >= 65 ? "Immediate Revenue Wins" : "Long-Term Growth";
  }

  if (input.category === "Customer Lifetime Value") {
    return "Strategic Opportunities";
  }

  if (input.priorityScore >= 75 && input.hasDeterministicImpact) {
    return "Immediate Revenue Wins";
  }

  if (input.priorityScore < 50) {
    return "Long-Term Growth";
  }

  if (input.category === "Revenue Growth") {
    return input.hasDeterministicImpact ? "Immediate Revenue Wins" : "Strategic Opportunities";
  }

  return "Strategic Opportunities";
}

export function buildGrowthRecommendationGroups(
  recommendations: Array<{ id: string; group: GrowthIntelligenceGroup }>,
) {
  return {
    immediateRevenueWins: recommendations
      .filter((item) => item.group === "Immediate Revenue Wins")
      .map((item) => item.id),
    aovGrowth: recommendations.filter((item) => item.group === "AOV Growth").map((item) => item.id),
    retention: recommendations.filter((item) => item.group === "Retention").map((item) => item.id),
    repeatPurchases: recommendations.filter((item) => item.group === "Repeat Purchases").map((item) => item.id),
    collections: recommendations.filter((item) => item.group === "Collections").map((item) => item.id),
    campaigns: recommendations.filter((item) => item.group === "Campaigns").map((item) => item.id),
    merchandising: recommendations.filter((item) => item.group === "Merchandising").map((item) => item.id),
    seasonalGrowth: recommendations.filter((item) => item.group === "Seasonal Growth").map((item) => item.id),
    longTermGrowth: recommendations.filter((item) => item.group === "Long-Term Growth").map((item) => item.id),
    strategicOpportunities: recommendations
      .filter((item) => item.group === "Strategic Opportunities")
      .map((item) => item.id),
  };
}
