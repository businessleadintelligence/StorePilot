import type { StoreAuditFacts } from "../facts/store-audit-facts";
import type {
  StoreAuditEstimatedImpact,
  StoreAuditIntelligenceRecommendationDraft,
} from "../schemas/store-audit-intelligence";
import {
  calculateAuditPriorityScore,
  deriveAuditOverallConfidence,
  deriveAuditOverallPriority,
  rankAuditRecommendations,
} from "../tools/audit-ranking-tool";

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  Easy: 1.1,
  Medium: 1,
  Hard: 0.85,
};

function sectionScoreForCategory(facts: StoreAuditFacts, category: string): number {
  const mapping: Record<string, number> = {
    Homepage: facts.homepageScore,
    Navigation: facts.navigation.score,
    Collections: facts.collections.score,
    "Product Pages": facts.productPages.score,
    Theme: facts.themeScore,
    Apps: facts.apps.score,
    SEO: facts.seoScore,
    Accessibility: facts.accessibilityScore,
    "Mobile UX": facts.mobileScore,
    "Checkout Preparation": facts.conversionScore,
    "Conversion Optimization": facts.conversionScore,
  };

  return mapping[category] ?? facts.storeHealthScore;
}

export type RankedStoreAuditRecommendationDraft = StoreAuditIntelligenceRecommendationDraft & {
  priorityScore: number;
};

export function buildStoreAuditMerchantPreferenceProfile(
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

export function rankStoreAuditRecommendations(input: {
  facts: StoreAuditFacts;
  recommendations: StoreAuditIntelligenceRecommendationDraft[];
  impacts: Map<string, StoreAuditEstimatedImpact>;
  preferences?: ReturnType<typeof buildStoreAuditMerchantPreferenceProfile>;
}): RankedStoreAuditRecommendationDraft[] {
  const ranked = input.recommendations.map((recommendation) => {
    const impact = input.impacts.get(recommendation.id) ?? {};
    const difficultyWeight = DIFFICULTY_WEIGHTS[recommendation.difficulty] ?? 1;
    let priorityScore = calculateAuditPriorityScore({
      confidence: recommendation.confidence,
      difficultyWeight,
      impact,
      sectionScore: sectionScoreForCategory(input.facts, recommendation.category),
    });

    if (input.preferences?.ignoredCategories.has(recommendation.category)) {
      priorityScore = Math.max(0, priorityScore - 15);
    }

    return {
      ...recommendation,
      priorityScore,
    };
  });

  return rankAuditRecommendations(ranked);
}

export { deriveAuditOverallConfidence, deriveAuditOverallPriority };
