import { AIPlatformError } from "../core/ai-errors";
import type { ProductFacts } from "../facts/product-facts";
import {
  PRODUCT_INTELLIGENCE_CATEGORIES,
  productIntelligenceEnrichedSchema,
  type ProductIntelligenceOutput,
} from "../schemas/product-intelligence";
import { getProductIntelligenceExecutionContext } from "./agent-execution-context";
import { mutateAndEnrichProductIntelligenceOutput } from "./product-intelligence-enrichment";
import { areRecommendationsSimilar } from "./product-intelligence-similarity";

const VAGUE_PATTERNS = [
  /^increase sales$/i,
  /^improve marketing$/i,
  /^boost revenue$/i,
  /^optimize performance$/i,
  /^increase inventory$/i,
  /^reorder inventory$/i,
  /^restock inventory$/i,
];

export function isVagueRecommendationText(value: string): boolean {
  const normalized = value.trim();
  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function validateProductIntelligenceBusinessRules(
  facts: ProductFacts,
  output: ProductIntelligenceOutput,
): void {
  if (output.healthScore !== facts.healthScore) {
    throw AIPlatformError.businessRuleValidation("health_score_mismatch");
  }

  if (output.recommendations.length === 0) {
    throw AIPlatformError.businessRuleValidation("empty_recommendations");
  }

  const recommendationIds = new Set<string>();

  for (const recommendation of output.recommendations) {
    if (recommendationIds.has(recommendation.id)) {
      throw AIPlatformError.businessRuleValidation("duplicate_recommendation_id");
    }

    recommendationIds.add(recommendation.id);

    if (!PRODUCT_INTELLIGENCE_CATEGORIES.includes(recommendation.category)) {
      throw AIPlatformError.businessRuleValidation("unknown_recommendation_category");
    }

    if (recommendation.confidence < 0 || recommendation.confidence > 1) {
      throw AIPlatformError.businessRuleValidation("recommendation_confidence_out_of_range");
    }

    if (recommendation.evidenceKeys.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_evidence_keys");
    }

    if (recommendation.merchantAction.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_merchant_action");
    }

    if (
      isVagueRecommendationText(recommendation.title) ||
      isVagueRecommendationText(recommendation.reason) ||
      recommendation.merchantAction.some((action) => isVagueRecommendationText(action))
    ) {
      throw AIPlatformError.businessRuleValidation("vague_recommendation");
    }
  }

  for (let index = 0; index < output.recommendations.length; index += 1) {
    for (let inner = index + 1; inner < output.recommendations.length; inner += 1) {
      if (areRecommendationsSimilar(output.recommendations[index], output.recommendations[inner])) {
        throw AIPlatformError.businessRuleValidation("similar_recommendation_duplicate");
      }
    }
  }

  const executionContext = getProductIntelligenceExecutionContext();
  if (executionContext) {
    for (const recommendation of output.recommendations) {
      if (executionContext.recommendationMemory.implementedIds.has(recommendation.id)) {
        throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
      }
    }
  }

  const enriched = (() => {
    try {
      return mutateAndEnrichProductIntelligenceOutput({
        facts,
        output,
        executionContext,
      });
    } catch {
      throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
    }
  })();

  const parsed = productIntelligenceEnrichedSchema.safeParse(enriched);
  if (!parsed.success) {
    throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
  }
}

export function extractProductIntelligenceRecommendations(
  output: ProductIntelligenceOutput,
) {
  const executionContext = getProductIntelligenceExecutionContext();
  const recommendations = output.recommendations as Array<
    ProductIntelligenceOutput["recommendations"][number] & {
      priority?: number;
      priorityScore?: number;
      group?: string;
      tasks?: string[];
      timeline?: Record<string, unknown>;
      evidence?: string[];
      verification?: Record<string, unknown>;
      estimatedImpact?: Record<string, unknown>;
      expectedImpact?: string;
      estimatedDifficulty?: string;
    }
  >;

  return recommendations
    .filter((recommendation) => {
      if (executionContext?.recommendationMemory.implementedIds.has(recommendation.id)) {
        return false;
      }

      if (executionContext?.recommendationMemory.openIds.has(recommendation.id)) {
        return false;
      }

      if (executionContext?.recommendationMemory.snoozedIds.has(recommendation.id)) {
        return false;
      }

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
