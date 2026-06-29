import type { PricingIntelligenceFacts } from "../facts/pricing-intelligence-facts";
import type {
  PricingEstimatedImpact,
  PricingIntelligenceCategory,
  PricingIntelligenceRecommendationDraft,
} from "../schemas/pricing-intelligence";
import {
  calculatePricingPriorityScore,
  derivePricingOverallConfidence,
  derivePricingOverallPriority,
  rankPricingRecommendations,
} from "../tools/pricing-ranking-tool";

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  Easy: 1.1,
  Medium: 1,
  Hard: 0.85,
};

export type RankedPricingIntelligenceRecommendationDraft = PricingIntelligenceRecommendationDraft & {
  priorityScore: number;
};

export type PricingMerchantPreferenceProfile = {
  dismissedCategories: Set<PricingIntelligenceCategory>;
  snoozedCategories: Set<PricingIntelligenceCategory>;
  ignoredCategories: Set<PricingIntelligenceCategory>;
  implementedCategories: Set<PricingIntelligenceCategory>;
};

function sectionScoreForCategory(facts: PricingIntelligenceFacts, category: string): number {
  const mapping: Record<string, number> = {
    "Margin Protection": facts.margin.marginPercent,
    "Discount Optimization": facts.discount.score,
    "Premium Pricing": facts.premium.score,
    "Inventory Pricing": facts.inventory.score,
    "Bundle Pricing": facts.bundle.score,
    "Psychological Pricing": facts.psychology.score,
    "Price Consistency": facts.priceConsistency.priceConsistencyScore,
    "Revenue Optimization": Math.max(0, 100 - facts.revenue.revenueRisk),
    "Conversion Pricing": facts.conversion.score,
    "Markdown Timing": facts.discount.score,
    "Competitive Pricing": facts.competition.score,
    "Loss Leader Strategy": facts.strategySignals.lossLeaderCandidates > 0 ? 55 : 85,
  };

  return mapping[category] ?? facts.pricingHealthScore;
}

export function buildPricingMerchantPreferenceProfile(
  records: Array<{ category: string; status: string; payloadJson: Record<string, unknown> }>,
): PricingMerchantPreferenceProfile {
  const dismissedCategories = new Set<PricingIntelligenceCategory>();
  const snoozedCategories = new Set<PricingIntelligenceCategory>();
  const ignoredCategories = new Set<PricingIntelligenceCategory>();
  const implementedCategories = new Set<PricingIntelligenceCategory>();

  for (const record of records) {
    const category = record.category as PricingIntelligenceCategory;
    const feedback = String(record.payloadJson.feedback ?? "").toLowerCase();

    if (feedback === "snoozed" || record.payloadJson.snoozedUntil) {
      snoozedCategories.add(category);
    }

    if (feedback === "ignored") {
      ignoredCategories.add(category);
    }

    if (record.status === "dismissed") {
      dismissedCategories.add(category);
    }

    if (record.status === "implemented" || record.status === "verified") {
      implementedCategories.add(category);
    }
  }

  return {
    dismissedCategories,
    snoozedCategories,
    ignoredCategories,
    implementedCategories,
  };
}

export function rankPricingIntelligenceRecommendations(input: {
  facts: PricingIntelligenceFacts;
  recommendations: PricingIntelligenceRecommendationDraft[];
  impacts: Map<string, PricingEstimatedImpact>;
  preferences?: PricingMerchantPreferenceProfile;
}): RankedPricingIntelligenceRecommendationDraft[] {
  const ranked = input.recommendations.map((recommendation) => {
    const impact = input.impacts.get(recommendation.id) ?? {};
    const difficultyWeight = DIFFICULTY_WEIGHTS[recommendation.difficulty] ?? 1;
    let priorityScore = calculatePricingPriorityScore({
      confidence: recommendation.confidence,
      difficultyWeight,
      impact,
      sectionScore: sectionScoreForCategory(input.facts, recommendation.category),
    });

    if (input.preferences?.ignoredCategories.has(recommendation.category)) {
      priorityScore = Math.max(0, priorityScore - 15);
    }

    if (input.preferences?.dismissedCategories.has(recommendation.category)) {
      priorityScore = Math.max(0, priorityScore - 10);
    }

    return {
      ...recommendation,
      priorityScore,
    };
  });

  return rankPricingRecommendations(ranked);
}

export { derivePricingOverallConfidence, derivePricingOverallPriority };
