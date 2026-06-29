import type { StoreAuditIntelligenceGroup } from "../schemas/store-audit-intelligence";

export function assignStoreAuditRecommendationGroup(input: {
  category: string;
  priorityScore: number;
  hasDeterministicImpact: boolean;
}): StoreAuditIntelligenceGroup {
  if (input.category === "Theme" || input.category === "Apps") {
    return input.priorityScore >= 70 ? "Performance Improvements" : "Critical Fixes";
  }

  if (input.category === "SEO") {
    return "SEO Improvements";
  }

  if (input.priorityScore >= 75) {
    return "Critical Fixes";
  }

  if (input.hasDeterministicImpact && input.priorityScore >= 55) {
    return "Quick Wins";
  }

  if (input.priorityScore < 50) {
    return "Long-Term CRO";
  }

  return "Quick Wins";
}

export function buildStoreAuditRecommendationGroups(
  recommendations: Array<{ id: string; group: StoreAuditIntelligenceGroup }>,
) {
  return {
    criticalFixes: recommendations.filter((item) => item.group === "Critical Fixes").map((item) => item.id),
    quickWins: recommendations.filter((item) => item.group === "Quick Wins").map((item) => item.id),
    seoImprovements: recommendations
      .filter((item) => item.group === "SEO Improvements")
      .map((item) => item.id),
    performanceImprovements: recommendations
      .filter((item) => item.group === "Performance Improvements")
      .map((item) => item.id),
    longTermCro: recommendations.filter((item) => item.group === "Long-Term CRO").map((item) => item.id),
  };
}
