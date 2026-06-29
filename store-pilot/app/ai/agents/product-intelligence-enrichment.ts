import type { ProductFacts } from "../facts/product-facts";
import type {
  ProductIntelligenceEnrichedOutput,
  ProductIntelligenceOutput,
  ProductIntelligenceRecommendation,
  ProductIntelligenceRecommendationDraft,
} from "../schemas/product-intelligence";
import {
  buildEvidenceCatalog,
  resolveEvidenceFromKeys,
  validateEvidenceKeys,
} from "./product-intelligence-evidence";
import { estimateRecommendationImpact } from "./product-intelligence-impact";
import {
  buildMerchantPreferenceProfile,
  deriveOverallConfidence,
  deriveOverallPriority,
  rankRecommendations,
  type RankedRecommendationDraft,
} from "./product-intelligence-ranking";
import { assignRecommendationGroup, buildRecommendationGroups } from "./product-intelligence-groups";
import { buildHealthExplanation } from "./product-intelligence-health";
import { dedupeSimilarRecommendations } from "./product-intelligence-similarity";
import type { ProductIntelligenceExecutionContext } from "./agent-execution-context";

function buildVerification(
  facts: ProductFacts,
  recommendation: ProductIntelligenceRecommendationDraft,
) {
  if (recommendation.category === "Inventory") {
    return {
      expectedMetric: "Inventory Days",
      expectedDirection:
        facts.stockRisk === "CRITICAL" || facts.stockRisk === "HIGH"
          ? ("Increase" as const)
          : ("Decrease" as const),
      expectedWindow: "14 days",
    };
  }

  if (recommendation.category === "Revenue" || recommendation.category === "Promotion") {
    return {
      expectedMetric: "30 day revenue",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (recommendation.category === "Pricing") {
    return {
      expectedMetric: "Margin",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  return {
    expectedMetric: "Product health score",
    expectedDirection: "Increase" as const,
    expectedWindow: "30 days",
  };
}

function buildTasks(recommendation: ProductIntelligenceRecommendationDraft): string[] {
  return recommendation.merchantAction.map((action) => action.trim()).filter(Boolean);
}

function buildTimeline(input: {
  detectedAt: string;
  existingTimeline?: Record<string, unknown>;
}) {
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

function mapDifficultyToLegacy(
  difficulty: ProductIntelligenceRecommendationDraft["difficulty"],
): "Low" | "Medium" | "High" {
  switch (difficulty) {
    case "Easy":
      return "Low";
    case "Hard":
      return "High";
    default:
      return "Medium";
  }
}

export function enrichProductIntelligenceOutput(input: {
  facts: ProductFacts;
  output: ProductIntelligenceOutput;
  executionContext?: ProductIntelligenceExecutionContext;
  detectedAt?: string;
}): ProductIntelligenceEnrichedOutput {
  const catalog =
    input.executionContext?.evidenceCatalog ?? buildEvidenceCatalog(input.facts);
  const detectedAt = input.detectedAt ?? input.facts.computedAt;
  const preferences = input.executionContext?.recommendationRecords
    ? buildMerchantPreferenceProfile(input.executionContext.recommendationRecords)
    : undefined;

  for (const recommendation of input.output.recommendations) {
    validateEvidenceKeys(recommendation.evidenceKeys, catalog);
  }

  const dedupedDrafts = dedupeSimilarRecommendations(input.output.recommendations);
  const impacts = new Map(
    dedupedDrafts.map((recommendation) => [
      recommendation.id,
      estimateRecommendationImpact(input.facts, recommendation),
    ]),
  );

  const ranked = rankRecommendations({
    facts: input.facts,
    recommendations: dedupedDrafts,
    impacts,
    preferences,
  });

  const enrichedRecommendations: ProductIntelligenceRecommendation[] = ranked.map(
    (recommendation: RankedRecommendationDraft, index) => {
      const impact = impacts.get(recommendation.id) ?? {};
      const group = assignRecommendationGroup({
        facts: input.facts,
        recommendation,
        impact,
        priorityScore: recommendation.priorityScore,
      });

      return {
        ...recommendation,
        priority: Math.min(5, index + 1),
        priorityScore: recommendation.priorityScore,
        estimatedImpact: impact,
        evidence: resolveEvidenceFromKeys(recommendation.evidenceKeys, catalog),
        verification: buildVerification(input.facts, recommendation),
        group,
        timeline: buildTimeline({ detectedAt }),
        tasks: buildTasks(recommendation),
        expectedImpact: recommendation.businessImpact,
        estimatedDifficulty: mapDifficultyToLegacy(recommendation.difficulty),
      };
    },
  );

  const recommendationGroups = buildRecommendationGroups(
    enrichedRecommendations.map((recommendation) => ({
      id: recommendation.id,
      group: recommendation.group,
    })),
  );

  return {
    ...input.output,
    priority: deriveOverallPriority(ranked),
    confidence: deriveOverallConfidence(ranked),
    healthExplanation: buildHealthExplanation(input.facts),
    recommendationGroups,
    recommendations: enrichedRecommendations,
  };
}

export function mutateAndEnrichProductIntelligenceOutput(input: {
  facts: ProductFacts;
  output: ProductIntelligenceOutput;
  executionContext?: ProductIntelligenceExecutionContext;
}): ProductIntelligenceEnrichedOutput {
  const enriched = enrichProductIntelligenceOutput(input);

  Object.assign(input.output, {
    priority: enriched.priority,
    confidence: enriched.confidence,
    healthExplanation: enriched.healthExplanation,
    recommendationGroups: enriched.recommendationGroups,
    recommendations: enriched.recommendations,
  });

  return enriched;
}
