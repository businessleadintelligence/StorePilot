import type { TrendFacts } from "../facts/trend-facts";
import type {
  TrendEstimatedImpact,
  TrendIntelligenceRecommendationDraft,
} from "../schemas/trend-intelligence";
import { estimateTrendImpact } from "../tools/trend-impact-tool";

export function estimateTrendRecommendationImpactForFacts(
  facts: TrendFacts,
  recommendation: TrendIntelligenceRecommendationDraft,
): TrendEstimatedImpact {
  const product = recommendation.productId
    ? facts.products.find((entry) => entry.productId === recommendation.productId)
    : facts.products[0];

  return estimateTrendImpact({
    category: recommendation.category,
    confidence: recommendation.confidence,
    momentum: product?.momentum ?? facts.momentum.averageMomentum,
    sales30Days: product?.sales30Days ?? facts.historicalSales.total30Days,
  });
}
