import { AIPlatformError } from "../core/ai-errors";
import type { TrendFacts } from "../facts/trend-facts";
import {
  TREND_INTELLIGENCE_CATEGORIES,
  trendIntelligenceEnrichedSchema,
  type TrendIntelligenceOutput,
} from "../schemas/trend-intelligence";
import { areTrendRecommendationsSimilar } from "../tools/trend-similarity-tool";
import { getTrendIntelligenceExecutionContext } from "./agent-execution-context";
import { mutateAndEnrichTrendIntelligenceOutput } from "./trend-intelligence-enrichment";
import { buildTrendEvidenceCatalog, validateTrendEvidenceKeys } from "./trend-intelligence-evidence";

const VAGUE_PATTERNS = [/^watch trends$/i, /^monitor demand$/i, /^track sales$/i, /^follow trends$/i];

export function isVagueTrendRecommendationText(value: string): boolean {
  return VAGUE_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function recommendationContradictsFacts(
  facts: TrendFacts,
  recommendation: TrendIntelligenceOutput["recommendations"][number],
): boolean {
  if (recommendation.category === "Emerging Opportunity" && facts.emergingProductIds.length === 0) {
    return true;
  }
  if (recommendation.category === "Declining Demand" && facts.decliningProductIds.length === 0) {
    return true;
  }
  if (recommendation.productId && !facts.products.some((product) => product.productId === recommendation.productId)) {
    return true;
  }
  if (recommendation.productId) {
    const product = facts.products.find((entry) => entry.productId === recommendation.productId);
    if (
      recommendation.category === "Emerging Opportunity" &&
      product &&
      product.direction === "declining"
    ) {
      return true;
    }
    if (
      recommendation.category === "Declining Demand" &&
      product &&
      product.direction === "emerging"
    ) {
      return true;
    }
  }
  return false;
}

export function validateTrendIntelligenceBusinessRules(
  facts: TrendFacts,
  output: TrendIntelligenceOutput,
): void {
  if (output.trendHealthScore !== facts.trendHealthScore) {
    throw AIPlatformError.businessRuleValidation("health_score_mismatch");
  }
  if (output.trendDirection !== facts.trendDirection) {
    throw AIPlatformError.businessRuleValidation("trend_direction_mismatch");
  }
  if (output.recommendations.length === 0) {
    throw AIPlatformError.businessRuleValidation("empty_recommendations");
  }

  const recommendationIds = new Set<string>();
  const recommendationTitles: Array<{ category: string; title: string }> = [];

  for (const recommendation of output.recommendations) {
    if (recommendationIds.has(recommendation.id)) {
      throw AIPlatformError.businessRuleValidation("duplicate_recommendation_id");
    }
    recommendationIds.add(recommendation.id);
    if (recommendationTitles.some((existing) => areTrendRecommendationsSimilar(existing, recommendation))) {
      throw AIPlatformError.businessRuleValidation("duplicate_recommendation");
    }
    recommendationTitles.push({ category: recommendation.category, title: recommendation.title });

    if (!TREND_INTELLIGENCE_CATEGORIES.includes(recommendation.category)) {
      throw AIPlatformError.businessRuleValidation("unknown_recommendation_category");
    }
    if (recommendation.evidenceKeys.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_evidence_keys");
    }
    if (recommendation.merchantAction.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_merchant_action");
    }
    if (
      isVagueTrendRecommendationText(recommendation.title) ||
      isVagueTrendRecommendationText(recommendation.reason) ||
      recommendation.merchantAction.some((action) => isVagueTrendRecommendationText(action))
    ) {
      throw AIPlatformError.businessRuleValidation("vague_recommendation");
    }
    if (recommendationContradictsFacts(facts, recommendation)) {
      throw AIPlatformError.businessRuleValidation("contradictory_trend");
    }
    if (facts.implementedRecommendationIds.includes(recommendation.id)) {
      throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
    }
  }

  const catalog =
    getTrendIntelligenceExecutionContext()?.evidenceCatalog ?? buildTrendEvidenceCatalog(facts);
  for (const recommendation of output.recommendations) {
    try {
      validateTrendEvidenceKeys(recommendation.evidenceKeys, catalog);
    } catch {
      throw AIPlatformError.businessRuleValidation("invalid_evidence_key");
    }
  }

  const executionContext = getTrendIntelligenceExecutionContext();
  if (executionContext) {
    for (const recommendation of output.recommendations) {
      if (executionContext.recommendationMemory.implementedIds.has(recommendation.id)) {
        throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
      }
    }
  }

  const enriched = mutateAndEnrichTrendIntelligenceOutput({ facts, output, executionContext });
  const parsed = trendIntelligenceEnrichedSchema.safeParse(enriched);
  if (!parsed.success) {
    throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
  }
}

export function extractTrendIntelligenceRecommendations(output: TrendIntelligenceOutput) {
  const executionContext = getTrendIntelligenceExecutionContext();
  return output.recommendations
    .filter((recommendation) => {
      if (executionContext?.recommendationMemory.implementedIds.has(recommendation.id)) return false;
      if (executionContext?.recommendationMemory.openIds.has(recommendation.id)) return false;
      if (executionContext?.recommendationMemory.snoozedIds.has(recommendation.id)) return false;
      return true;
    })
    .map((recommendation) => {
      let priority = recommendation.priority ?? 3;
      if (executionContext?.recommendationMemory.dismissedIds.has(recommendation.id)) {
        priority = Math.min(5, priority + 1);
      }
      if (executionContext?.recommendationMemory.ignoredIds.has(recommendation.id)) {
        priority = Math.min(5, priority + 1);
      }
      return {
        category: recommendation.category,
        title: recommendation.title,
        summary: recommendation.reason,
        priority,
        confidence: recommendation.confidence,
        payload: recommendation as unknown as Record<string, unknown>,
      };
    });
}
