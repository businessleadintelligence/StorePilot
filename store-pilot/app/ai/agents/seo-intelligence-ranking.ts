import type { SeoIntelligenceFacts } from "../facts/seo-intelligence-facts";
import type {
  SeoEstimatedImpact,
  SeoIntelligenceRecommendationDraft,
} from "../schemas/seo-intelligence";
import {
  calculateSeoPriorityScore,
  deriveSeoOverallConfidence,
  deriveSeoOverallPriority,
  rankSeoRecommendations,
} from "../tools/seo-ranking-tool";

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  Easy: 1.1,
  Medium: 1,
  Hard: 0.85,
};

function sectionScoreForCategory(facts: SeoIntelligenceFacts, category: string): number {
  const mapping: Record<string, number> = {
    "Technical SEO": facts.scores.technicalSeoScore,
    Content: facts.scores.contentScore,
    Images: facts.scores.imageOptimizationScore,
    Collections: facts.scores.contentScore,
    Products: facts.scores.contentScore,
    Navigation: facts.scores.internalLinkingScore,
    "Internal Linking": facts.scores.internalLinkingScore,
    "Structured Data": facts.scores.structuredDataScore,
    "Core Web Vitals": facts.scores.coreWebVitalsScore,
    Indexability: facts.scores.indexabilityScore,
    Accessibility: facts.scores.accessibilityScore,
    Schema: facts.scores.structuredDataScore,
    Metadata: facts.scores.contentScore,
    "Merchant Trust": facts.scores.seoScore,
    "Conversion SEO": facts.scores.organicOpportunityScore,
  };

  return mapping[category] ?? facts.seoHealthScore;
}

export type RankedSeoIntelligenceRecommendationDraft = SeoIntelligenceRecommendationDraft & {
  priorityScore: number;
};

export function buildSeoMerchantPreferenceProfile(
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

export function rankSeoIntelligenceRecommendations(input: {
  facts: SeoIntelligenceFacts;
  recommendations: SeoIntelligenceRecommendationDraft[];
  impacts: Map<string, SeoEstimatedImpact>;
  preferences?: ReturnType<typeof buildSeoMerchantPreferenceProfile>;
}): RankedSeoIntelligenceRecommendationDraft[] {
  const ranked = input.recommendations.map((recommendation) => {
    const impact = input.impacts.get(recommendation.id) ?? {};
    const difficultyWeight = DIFFICULTY_WEIGHTS[recommendation.difficulty] ?? 1;
    let priorityScore = calculateSeoPriorityScore({
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

  return rankSeoRecommendations(ranked);
}

export { deriveSeoOverallConfidence, deriveSeoOverallPriority };
