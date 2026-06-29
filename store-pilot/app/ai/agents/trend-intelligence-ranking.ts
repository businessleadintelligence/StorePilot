import type { TrendFacts } from "../facts/trend-facts";
import type {
  TrendEstimatedImpact,
  TrendIntelligenceRecommendationDraft,
} from "../schemas/trend-intelligence";
import {
  calculateTrendPriorityScore,
  deriveTrendOverallConfidence,
  deriveTrendOverallPriority,
  rankTrendRecommendations,
} from "../tools/trend-ranking-tool";

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  Easy: 1.1,
  Medium: 1,
  Hard: 0.85,
};

export type RankedTrendRecommendationDraft = TrendIntelligenceRecommendationDraft & {
  priorityScore: number;
};

export function buildTrendMerchantPreferenceProfile(
  records: Array<{ category: string; status: string; payloadJson: Record<string, unknown> }>,
) {
  const ignoredCategories = new Set<string>();
  for (const record of records) {
    const feedback = String(record.payloadJson.feedback ?? "").toLowerCase();
    if (feedback === "ignored" || record.status === "dismissed") {
      ignoredCategories.add(record.category);
    }
  }
  return { ignoredCategories };
}

export function rankTrendRecommendationsForFacts(input: {
  facts: TrendFacts;
  recommendations: TrendIntelligenceRecommendationDraft[];
  impacts: Map<string, TrendEstimatedImpact>;
  preferences?: ReturnType<typeof buildTrendMerchantPreferenceProfile>;
}): RankedTrendRecommendationDraft[] {
  const ranked = input.recommendations.map((recommendation) => {
    const impact = input.impacts.get(recommendation.id) ?? {};
    const product = recommendation.productId
      ? input.facts.products.find((entry) => entry.productId === recommendation.productId)
      : undefined;
    let priorityScore = calculateTrendPriorityScore({
      confidence: recommendation.confidence,
      difficultyWeight: DIFFICULTY_WEIGHTS[recommendation.difficulty] ?? 1,
      impact,
      momentum: product?.momentum ?? input.facts.momentum.averageMomentum,
    });
    if (input.preferences?.ignoredCategories.has(recommendation.category)) {
      priorityScore = Math.max(0, priorityScore - 15);
    }
    return { ...recommendation, priorityScore };
  });
  return rankTrendRecommendations(ranked);
}

export { deriveTrendOverallConfidence, deriveTrendOverallPriority };
