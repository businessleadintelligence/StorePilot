import type { SeoIntelligenceGroup } from "../schemas/seo-intelligence";

export function assignSeoRecommendationGroup(input: {
  category: string;
  priorityScore: number;
  hasDeterministicImpact: boolean;
}): SeoIntelligenceGroup {
  if (input.category === "Core Web Vitals" || input.category === "Technical SEO") {
    return input.priorityScore >= 70 ? "Critical Fixes" : "Technical Improvements";
  }

  if (input.category === "Structured Data" || input.category === "Schema") {
    return "Technical Improvements";
  }

  if (input.priorityScore >= 75) {
    return "Critical Fixes";
  }

  if (input.hasDeterministicImpact && input.priorityScore >= 55) {
    return "Quick Wins";
  }

  if (input.category === "Content" || input.category === "Metadata") {
    return input.priorityScore >= 50 ? "Organic Growth" : "Long-Term SEO Strategy";
  }

  if (input.priorityScore < 50) {
    return "Long-Term SEO Strategy";
  }

  return "Quick Wins";
}

export function buildSeoRecommendationGroups(
  recommendations: Array<{ id: string; group: SeoIntelligenceGroup }>,
) {
  return {
    criticalFixes: recommendations.filter((item) => item.group === "Critical Fixes").map((item) => item.id),
    quickWins: recommendations.filter((item) => item.group === "Quick Wins").map((item) => item.id),
    organicGrowth: recommendations.filter((item) => item.group === "Organic Growth").map((item) => item.id),
    technicalImprovements: recommendations
      .filter((item) => item.group === "Technical Improvements")
      .map((item) => item.id),
    longTermSeoStrategy: recommendations
      .filter((item) => item.group === "Long-Term SEO Strategy")
      .map((item) => item.id),
  };
}
