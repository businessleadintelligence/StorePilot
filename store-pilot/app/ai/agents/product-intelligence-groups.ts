import type { ProductFacts } from "../facts/product-facts";
import type {
  ProductIntelligenceGroup,
  ProductIntelligenceRecommendationDraft,
} from "../schemas/product-intelligence";
import type { EstimatedImpact } from "../schemas/product-intelligence";
import { hasDeterministicImpact } from "./product-intelligence-impact";

export function assignRecommendationGroup(input: {
  facts: ProductFacts;
  recommendation: ProductIntelligenceRecommendationDraft;
  impact: EstimatedImpact;
  priorityScore: number;
}): ProductIntelligenceGroup {
  const { facts, recommendation, impact, priorityScore } = input;

  if (
    facts.stockRisk === "CRITICAL" ||
    facts.stockRisk === "HIGH" ||
    facts.refundRate >= 8 ||
    (facts.daysRemaining !== null && facts.daysRemaining <= 7 && recommendation.category === "Inventory")
  ) {
    return "Critical Risks";
  }

  if (hasDeterministicImpact(impact) && (impact.revenueOpportunity || impact.revenueRecovered)) {
    return "Revenue Opportunities";
  }

  if (recommendation.difficulty === "Easy" && priorityScore >= 60) {
    return "Quick Wins";
  }

  if (recommendation.category === "SEO" || recommendation.category === "Conversion") {
    return "Long-Term Strategy";
  }

  return "Operational Improvements";
}

export function buildRecommendationGroups(
  recommendations: Array<{ id: string; group: ProductIntelligenceGroup }>,
) {
  return {
    criticalRisks: recommendations.filter((item) => item.group === "Critical Risks").map((item) => item.id),
    revenueOpportunities: recommendations
      .filter((item) => item.group === "Revenue Opportunities")
      .map((item) => item.id),
    quickWins: recommendations.filter((item) => item.group === "Quick Wins").map((item) => item.id),
    operationalImprovements: recommendations
      .filter((item) => item.group === "Operational Improvements")
      .map((item) => item.id),
    longTermStrategy: recommendations
      .filter((item) => item.group === "Long-Term Strategy")
      .map((item) => item.id),
  };
}
