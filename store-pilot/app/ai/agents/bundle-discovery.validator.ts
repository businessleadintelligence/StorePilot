import { AIPlatformError } from "../core/ai-errors";
import type { BundleFacts } from "../facts/bundle-facts";
import {
  BUNDLE_INTELLIGENCE_CATEGORIES,
  bundleIntelligenceEnrichedSchema,
  type BundleIntelligenceOutput,
} from "../schemas/bundle-intelligence";
import { passesMinimumBundleConfidence } from "../tools/bundle-confidence-tool";
import { areBundlesSimilar } from "../tools/bundle-similarity-tool";
import { getBundleDiscoveryExecutionContext } from "./agent-execution-context";
import { mutateAndEnrichBundleDiscoveryOutput } from "./bundle-discovery-enrichment";
import {
  buildBundleEvidenceCatalog,
  validateBundleEvidenceKeys,
} from "./bundle-discovery-evidence";

const VAGUE_PATTERNS = [
  /^create a bundle$/i,
  /^bundle products$/i,
  /^sell together$/i,
  /^improve merchandising$/i,
  /^make a kit$/i,
];

export function isVagueBundleRecommendationText(value: string): boolean {
  const normalized = value.trim();
  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function findMatchingCandidate(
  facts: BundleFacts,
  recommendation: BundleIntelligenceOutput["recommendations"][number],
) {
  return (
    facts.bundleCandidates.find((item) => item.id === recommendation.id) ??
    facts.bundleCandidates.find((item) =>
      areBundlesSimilar(item.productIds, recommendation.bundleProductIds),
    )
  );
}

function recommendationContradictsFacts(
  facts: BundleFacts,
  recommendation: BundleIntelligenceOutput["recommendations"][number],
): boolean {
  const candidate = findMatchingCandidate(facts, recommendation);
  if (!candidate) {
    return true;
  }

  if (recommendation.category === "Dead Inventory Bundle" && facts.deadInventoryPairCount === 0) {
    return true;
  }

  if (!areBundlesSimilar(recommendation.bundleProductIds, candidate.productIds)) {
    return true;
  }

  return false;
}

function isInvalidBundleCombination(
  facts: BundleFacts,
  recommendation: BundleIntelligenceOutput["recommendations"][number],
): boolean {
  if (recommendation.bundleProductIds.length < 2 || recommendation.bundleProductIds.length > 4) {
    return true;
  }

  const knownProductIds = new Set(facts.products.map((product) => product.productId));
  return recommendation.bundleProductIds.some((productId) => !knownProductIds.has(productId));
}

function isAlreadyBundled(
  facts: BundleFacts,
  recommendation: BundleIntelligenceOutput["recommendations"][number],
): boolean {
  return facts.implementedBundleIds.some((id) =>
    areBundlesSimilar(
      recommendation.bundleProductIds,
      id.replace(/^bundle:/, "").split(":"),
    ),
  );
}

export function validateBundleDiscoveryBusinessRules(
  facts: BundleFacts,
  output: BundleIntelligenceOutput,
): void {
  if (output.bundleHealthScore !== facts.bundleHealthScore) {
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

    if (!BUNDLE_INTELLIGENCE_CATEGORIES.includes(recommendation.category)) {
      throw AIPlatformError.businessRuleValidation("unknown_recommendation_category");
    }

    if (!passesMinimumBundleConfidence(recommendation.confidence)) {
      throw AIPlatformError.businessRuleValidation("low_confidence_bundle");
    }

    if (recommendation.evidenceKeys.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_evidence_keys");
    }

    if (recommendation.merchantAction.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_merchant_action");
    }

    if (isInvalidBundleCombination(facts, recommendation)) {
      throw AIPlatformError.businessRuleValidation("invalid_bundle_combination");
    }

    if (isAlreadyBundled(facts, recommendation)) {
      throw AIPlatformError.businessRuleValidation("products_already_bundled");
    }

    if (
      isVagueBundleRecommendationText(recommendation.title) ||
      isVagueBundleRecommendationText(recommendation.reason) ||
      recommendation.merchantAction.some((action) => isVagueBundleRecommendationText(action))
    ) {
      throw AIPlatformError.businessRuleValidation("vague_recommendation");
    }

    if (recommendationContradictsFacts(facts, recommendation)) {
      throw AIPlatformError.businessRuleValidation("recommendation_contradicts_facts");
    }
  }

  const catalog =
    getBundleDiscoveryExecutionContext()?.evidenceCatalog ?? buildBundleEvidenceCatalog(facts);

  for (const recommendation of output.recommendations) {
    try {
      validateBundleEvidenceKeys(recommendation.evidenceKeys, catalog);
    } catch {
      throw AIPlatformError.businessRuleValidation("invalid_evidence_key");
    }
  }

  const executionContext = getBundleDiscoveryExecutionContext();
  if (executionContext) {
    for (const recommendation of output.recommendations) {
      if (executionContext.recommendationMemory.implementedIds.has(recommendation.id)) {
        throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
      }
    }
  }

  const enriched = mutateAndEnrichBundleDiscoveryOutput({
    facts,
    output,
    executionContext,
  });

  const parsed = bundleIntelligenceEnrichedSchema.safeParse(enriched);
  if (!parsed.success) {
    throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
  }
}

export function extractBundleDiscoveryRecommendations(output: BundleIntelligenceOutput) {
  const executionContext = getBundleDiscoveryExecutionContext();
  const recommendations = output.recommendations as Array<
    BundleIntelligenceOutput["recommendations"][number] & {
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
