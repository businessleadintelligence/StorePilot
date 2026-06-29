import type { GrowthIntelligenceFacts } from "../facts/growth-intelligence-facts";
import type {
  GrowthEstimatedImpact,
  GrowthIntelligenceCategory,
  GrowthIntelligenceRecommendationDraft,
} from "../schemas/growth-intelligence";
import {
  calculateGrowthPriorityScore,
  deriveGrowthOverallConfidence,
  deriveGrowthOverallPriority,
  rankGrowthRecommendations,
} from "../tools/growth-ranking-tool";
import { sectionScoreForCategory } from "./growth-intelligence-evidence";

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  Easy: 1.1,
  Medium: 1,
  Hard: 0.85,
};

export type RankedGrowthIntelligenceRecommendationDraft = GrowthIntelligenceRecommendationDraft & {
  priorityScore: number;
};

export type GrowthMerchantPreferenceProfile = {
  dismissedCategories: Set<GrowthIntelligenceCategory>;
  snoozedCategories: Set<GrowthIntelligenceCategory>;
  ignoredCategories: Set<GrowthIntelligenceCategory>;
  implementedCategories: Set<GrowthIntelligenceCategory>;
};

export function buildGrowthMerchantPreferenceProfile(
  records: Array<{ category: string; status: string; payloadJson: Record<string, unknown> }>,
): GrowthMerchantPreferenceProfile {
  const dismissedCategories = new Set<GrowthIntelligenceCategory>();
  const snoozedCategories = new Set<GrowthIntelligenceCategory>();
  const ignoredCategories = new Set<GrowthIntelligenceCategory>();
  const implementedCategories = new Set<GrowthIntelligenceCategory>();

  for (const record of records) {
    const category = record.category as GrowthIntelligenceCategory;
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

export function rankGrowthIntelligenceRecommendations(input: {
  facts: GrowthIntelligenceFacts;
  recommendations: GrowthIntelligenceRecommendationDraft[];
  impacts: Map<string, GrowthEstimatedImpact>;
  preferences?: GrowthMerchantPreferenceProfile;
}): RankedGrowthIntelligenceRecommendationDraft[] {
  const ranked = input.recommendations.map((recommendation) => {
    const impact = input.impacts.get(recommendation.id) ?? {};
    const difficultyWeight = DIFFICULTY_WEIGHTS[recommendation.difficulty] ?? 1;
    let priorityScore = calculateGrowthPriorityScore({
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

  return rankGrowthRecommendations(ranked);
}

export { deriveGrowthOverallConfidence, deriveGrowthOverallPriority };
