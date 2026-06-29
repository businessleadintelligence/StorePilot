import { AIPlatformError } from "../core/ai-errors";
import type { InventoryFacts } from "../facts/inventory-facts";
import {
  INVENTORY_INTELLIGENCE_CATEGORIES,
  inventoryIntelligenceEnrichedSchema,
  type InventoryIntelligenceOutput,
} from "../schemas/inventory-intelligence";
import { getInventoryIntelligenceExecutionContext } from "./agent-execution-context";
import { mutateAndEnrichInventoryIntelligenceOutput } from "./inventory-intelligence-enrichment";
import {
  buildInventoryEvidenceCatalog,
  validateInventoryEvidenceKeys,
} from "./inventory-intelligence-evidence";

const VAGUE_PATTERNS = [
  /^reorder inventory$/i,
  /^fix stock$/i,
  /^reduce overstock$/i,
  /^improve inventory$/i,
  /^restock products$/i,
];

export function isVagueInventoryRecommendationText(value: string): boolean {
  const normalized = value.trim();
  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function recommendationContradictsFacts(
  facts: InventoryFacts,
  recommendation: InventoryIntelligenceOutput["recommendations"][number],
): boolean {
  if (recommendation.category === "Stockout" && facts.stockoutAlertCount === 0) {
    return true;
  }

  if (recommendation.category === "Dead Inventory" && facts.deadStockCount === 0) {
    return true;
  }

  if (recommendation.category === "Overstock" && facts.overstockCount === 0) {
    return true;
  }

  return false;
}

export function validateInventoryIntelligenceBusinessRules(
  facts: InventoryFacts,
  output: InventoryIntelligenceOutput,
): void {
  if (output.inventoryHealthScore !== facts.inventoryHealthScore) {
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

    if (!INVENTORY_INTELLIGENCE_CATEGORIES.includes(recommendation.category)) {
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
      isVagueInventoryRecommendationText(recommendation.title) ||
      isVagueInventoryRecommendationText(recommendation.reason) ||
      recommendation.merchantAction.some((action) => isVagueInventoryRecommendationText(action))
    ) {
      throw AIPlatformError.businessRuleValidation("vague_recommendation");
    }

    if (recommendationContradictsFacts(facts, recommendation)) {
      throw AIPlatformError.businessRuleValidation("recommendation_contradicts_facts");
    }
  }

  const catalog =
    getInventoryIntelligenceExecutionContext()?.evidenceCatalog ??
    buildInventoryEvidenceCatalog(facts);

  for (const recommendation of output.recommendations) {
    try {
      validateInventoryEvidenceKeys(recommendation.evidenceKeys, catalog);
    } catch {
      throw AIPlatformError.businessRuleValidation("invalid_evidence_key");
    }
  }

  const executionContext = getInventoryIntelligenceExecutionContext();
  if (executionContext) {
    for (const recommendation of output.recommendations) {
      if (executionContext.recommendationMemory.implementedIds.has(recommendation.id)) {
        throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
      }
    }
  }

  const enriched = mutateAndEnrichInventoryIntelligenceOutput({
    facts,
    output,
    executionContext,
  });

  const parsed = inventoryIntelligenceEnrichedSchema.safeParse(enriched);
  if (!parsed.success) {
    throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
  }
}

export function extractInventoryIntelligenceRecommendations(output: InventoryIntelligenceOutput) {
  const executionContext = getInventoryIntelligenceExecutionContext();
  const recommendations = output.recommendations as Array<
    InventoryIntelligenceOutput["recommendations"][number] & {
      priority?: number;
      priorityScore?: number;
      group?: string;
      tasks?: string[];
      timeline?: Record<string, unknown>;
      evidence?: string[];
      verification?: Record<string, unknown>;
      estimatedImpact?: Record<string, unknown>;
      expectedImpact?: string;
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
