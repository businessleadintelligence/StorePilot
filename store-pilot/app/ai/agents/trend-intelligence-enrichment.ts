import type { TrendFacts } from "../facts/trend-facts";
import type {
  TrendIntelligenceEnrichedOutput,
  TrendIntelligenceOutput,
  TrendIntelligenceRecommendation,
  TrendIntelligenceRecommendationDraft,
} from "../schemas/trend-intelligence";
import type { TrendIntelligenceExecutionContext } from "./agent-execution-context";
import {
  buildTrendEvidenceCatalog,
  resolveTrendEvidenceFromKeys,
  validateTrendEvidenceKeys,
} from "./trend-intelligence-evidence";
import { estimateTrendRecommendationImpactForFacts } from "./trend-intelligence-impact";
import {
  assignTrendRecommendationGroupFromImpact,
  buildTrendRecommendationGroups,
} from "./trend-intelligence-groups";
import { buildTrendHealthExplanation } from "./trend-intelligence-health";
import {
  buildTrendMerchantPreferenceProfile,
  deriveTrendOverallConfidence,
  deriveTrendOverallPriority,
  rankTrendRecommendationsForFacts,
  type RankedTrendRecommendationDraft,
} from "./trend-intelligence-ranking";
import { dedupeSimilarTrendRecommendationsFromTools } from "./trend-intelligence-similarity";

function buildVerification(facts: TrendFacts, recommendation: TrendIntelligenceRecommendationDraft) {
  if (recommendation.category === "Declining Demand") {
    return {
      expectedMetric: "Product sales",
      expectedDirection: "Increase" as const,
      expectedWindow: "21 days",
    };
  }
  if (recommendation.category === "Emerging Opportunity" || recommendation.category === "Product Momentum") {
    return {
      expectedMetric: "Product sales",
      expectedDirection: "Increase" as const,
      expectedWindow: "14 days",
    };
  }
  if (recommendation.category === "Seasonal Trend") {
    return {
      expectedMetric: "Store revenue",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }
  return {
    expectedMetric: "Store revenue",
    expectedDirection: facts.rollingGrowth.storeGrowthRate >= 0 ? ("Increase" as const) : ("Stable" as const),
    expectedWindow: "21 days",
  };
}

function buildTimeline(input: { detectedAt: string; existingTimeline?: Record<string, unknown> }) {
  const existing = input.existingTimeline ?? {};
  return {
    detected: String(existing.detected ?? input.detectedAt),
    created: String(existing.created ?? input.detectedAt),
    viewed: existing.viewed ? String(existing.viewed) : null,
    implemented: existing.implemented ? String(existing.implemented) : null,
    verifying: existing.verifying ? String(existing.verifying) : null,
    verified: existing.verified ? String(existing.verified) : null,
    closed: existing.closed ? String(existing.closed) : null,
  };
}

export function enrichTrendIntelligenceOutput(input: {
  facts: TrendFacts;
  output: TrendIntelligenceOutput;
  executionContext?: TrendIntelligenceExecutionContext;
  detectedAt?: string;
}): TrendIntelligenceEnrichedOutput {
  const catalog =
    input.executionContext?.evidenceCatalog ?? buildTrendEvidenceCatalog(input.facts);
  const detectedAt = input.detectedAt ?? input.facts.computedAt;
  const preferences = input.executionContext?.recommendationRecords
    ? buildTrendMerchantPreferenceProfile(input.executionContext.recommendationRecords)
    : undefined;

  for (const recommendation of input.output.recommendations) {
    validateTrendEvidenceKeys(recommendation.evidenceKeys, catalog);
  }

  const dedupedDrafts = dedupeSimilarTrendRecommendationsFromTools(input.output.recommendations);
  const impacts = new Map(
    dedupedDrafts.map((recommendation) => [
      recommendation.id,
      estimateTrendRecommendationImpactForFacts(input.facts, recommendation),
    ]),
  );

  const ranked = rankTrendRecommendationsForFacts({
    facts: input.facts,
    recommendations: dedupedDrafts,
    impacts,
    preferences,
  });

  const enrichedRecommendations: TrendIntelligenceRecommendation[] = ranked.map(
    (recommendation: RankedTrendRecommendationDraft, index) => {
      const impact = impacts.get(recommendation.id) ?? {};
      const group = assignTrendRecommendationGroupFromImpact({
        category: recommendation.category,
        priorityScore: recommendation.priorityScore,
        impact,
      });
      return {
        ...recommendation,
        priority: Math.min(5, index + 1),
        priorityScore: recommendation.priorityScore,
        estimatedImpactMetrics: impact,
        evidence: resolveTrendEvidenceFromKeys(recommendation.evidenceKeys, catalog),
        verification: buildVerification(input.facts, recommendation),
        group,
        recommendationTimeline: buildTimeline({ detectedAt }),
        tasks: recommendation.merchantAction.map((action) => action.trim()).filter(Boolean),
      };
    },
  );

  const recommendationGroups = buildTrendRecommendationGroups(
    enrichedRecommendations.map((recommendation) => ({
      id: recommendation.id,
      group: recommendation.group,
    })),
  );

  const emergingProducts = input.output.emergingProducts.length
    ? input.output.emergingProducts
    : input.facts.products
        .filter((product) => product.direction === "emerging")
        .slice(0, 8)
        .map((product) => ({
          productId: product.productId,
          title: product.title,
          direction: product.direction,
          growthRate: product.growthRate,
          momentum: product.momentum,
          sales30Days: product.sales30Days,
        }));

  const decliningProducts = input.output.decliningProducts.length
    ? input.output.decliningProducts
    : input.facts.products
        .filter((product) => product.direction === "declining")
        .slice(0, 8)
        .map((product) => ({
          productId: product.productId,
          title: product.title,
          direction: product.direction,
          growthRate: product.growthRate,
          momentum: product.momentum,
          sales30Days: product.sales30Days,
        }));

  return {
    ...input.output,
    trendHealthScore: input.facts.trendHealthScore,
    trendDirection: input.facts.trendDirection,
    priority: deriveTrendOverallPriority(ranked.map((item) => item.priorityScore)),
    confidence: deriveTrendOverallConfidence(ranked.map((item) => item.confidence)),
    healthExplanation: buildTrendHealthExplanation(input.facts),
    recommendationGroups,
    recommendations: enrichedRecommendations,
    emergingProducts,
    decliningProducts,
    seasonalSignals:
      input.output.seasonalSignals.length > 0
        ? input.output.seasonalSignals
        : input.facts.seasonalSignals.map((signal) => ({
            label: signal.label,
            strength: signal.strength,
            month: signal.month,
          })),
  };
}

export function mutateAndEnrichTrendIntelligenceOutput(input: {
  facts: TrendFacts;
  output: TrendIntelligenceOutput;
  executionContext?: TrendIntelligenceExecutionContext;
}): TrendIntelligenceEnrichedOutput {
  const enriched = enrichTrendIntelligenceOutput(input);
  Object.assign(input.output, {
    priority: enriched.priority,
    confidence: enriched.confidence,
    healthExplanation: enriched.healthExplanation,
    recommendationGroups: enriched.recommendationGroups,
    recommendations: enriched.recommendations,
    trendHealthScore: enriched.trendHealthScore,
    trendDirection: enriched.trendDirection,
    emergingProducts: enriched.emergingProducts,
    decliningProducts: enriched.decliningProducts,
    seasonalSignals: enriched.seasonalSignals,
  });
  return enriched;
}
