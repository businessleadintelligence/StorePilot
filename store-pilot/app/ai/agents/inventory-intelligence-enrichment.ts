import type { InventoryFacts } from "../facts/inventory-facts";
import type {
  InventoryIntelligenceEnrichedOutput,
  InventoryIntelligenceOutput,
  InventoryIntelligenceRecommendation,
  InventoryIntelligenceRecommendationDraft,
} from "../schemas/inventory-intelligence";
import type { InventoryIntelligenceExecutionContext } from "./agent-execution-context";
import {
  buildInventoryEvidenceCatalog,
  resolveInventoryEvidenceFromKeys,
  validateInventoryEvidenceKeys,
} from "./inventory-intelligence-evidence";
import { estimateInventoryRecommendationImpactForFacts, hasInventoryDeterministicImpact } from "./inventory-intelligence-impact";
import {
  assignInventoryRecommendationGroup,
  buildInventoryRecommendationGroups,
} from "./inventory-intelligence-groups";
import { buildInventoryHealthExplanation } from "./inventory-intelligence-health";
import {
  buildInventoryMerchantPreferenceProfile,
  deriveInventoryOverallConfidence,
  deriveInventoryOverallPriority,
  rankInventoryRecommendations,
  type RankedInventoryRecommendationDraft,
} from "./inventory-intelligence-ranking";
import { dedupeSimilarInventoryRecommendations } from "./inventory-intelligence-similarity";

function buildVerification(
  facts: InventoryFacts,
  recommendation: InventoryIntelligenceRecommendationDraft,
) {
  if (recommendation.category === "Stockout" || recommendation.category === "Reorder") {
    return {
      expectedMetric: "Inventory Days",
      expectedDirection: "Increase" as const,
      expectedWindow: "14 days",
    };
  }

  if (recommendation.category === "Dead Inventory" || recommendation.category === "Clearance") {
    return {
      expectedMetric: "Dead stock units",
      expectedDirection: "Decrease" as const,
      expectedWindow: "30 days",
    };
  }

  if (recommendation.category === "Overstock") {
    return {
      expectedMetric: "Inventory coverage",
      expectedDirection: "Decrease" as const,
      expectedWindow: "30 days",
    };
  }

  return {
    expectedMetric: "Inventory health score",
    expectedDirection: "Increase" as const,
    expectedWindow: "30 days",
  };
}

function buildTasks(recommendation: InventoryIntelligenceRecommendationDraft): string[] {
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

export function enrichInventoryIntelligenceOutput(input: {
  facts: InventoryFacts;
  output: InventoryIntelligenceOutput;
  executionContext?: InventoryIntelligenceExecutionContext;
  detectedAt?: string;
}): InventoryIntelligenceEnrichedOutput {
  const catalog =
    input.executionContext?.evidenceCatalog ?? buildInventoryEvidenceCatalog(input.facts);
  const detectedAt = input.detectedAt ?? input.facts.computedAt;
  const preferences = input.executionContext?.recommendationRecords
    ? buildInventoryMerchantPreferenceProfile(input.executionContext.recommendationRecords)
    : undefined;

  for (const recommendation of input.output.recommendations) {
    validateInventoryEvidenceKeys(recommendation.evidenceKeys, catalog);
  }

  const dedupedDrafts = dedupeSimilarInventoryRecommendations(input.output.recommendations);
  const impacts = new Map(
    dedupedDrafts.map((recommendation) => [
      recommendation.id,
      estimateInventoryRecommendationImpactForFacts(input.facts, recommendation),
    ]),
  );

  const ranked = rankInventoryRecommendations({
    facts: input.facts,
    recommendations: dedupedDrafts,
    impacts,
    preferences,
  });

  const enrichedRecommendations: InventoryIntelligenceRecommendation[] = ranked.map(
    (recommendation: RankedInventoryRecommendationDraft, index) => {
      const impact = impacts.get(recommendation.id) ?? {};
      const group = assignInventoryRecommendationGroup({
        category: recommendation.category,
        priorityScore: recommendation.priorityScore,
        hasDeterministicImpact: hasInventoryDeterministicImpact(impact),
        stockoutAlertCount: input.facts.stockoutAlertCount,
      });

      return {
        ...recommendation,
        priority: Math.min(5, index + 1),
        priorityScore: recommendation.priorityScore,
        estimatedImpact: impact,
        evidence: resolveInventoryEvidenceFromKeys(recommendation.evidenceKeys, catalog),
        verification: buildVerification(input.facts, recommendation),
        group,
        timeline: buildTimeline({ detectedAt }),
        tasks: buildTasks(recommendation),
        expectedImpact: recommendation.businessImpact,
      };
    },
  );

  const recommendationGroups = buildInventoryRecommendationGroups(
    enrichedRecommendations.map((recommendation) => ({
      id: recommendation.id,
      group: recommendation.group,
    })),
  );

  return {
    ...input.output,
    inventoryHealthScore: input.facts.inventoryHealthScore,
    deadStockCount: input.facts.deadStockCount,
    stockoutAlertCount: input.facts.stockoutAlertCount,
    overstockCount: input.facts.overstockCount,
    understockCount: input.facts.understockCount,
    averageDaysRemaining: input.facts.averageDaysRemaining,
    stockAlerts: input.output.stockAlerts.length > 0 ? input.output.stockAlerts : input.facts.stockAlerts,
    reorderSuggestions:
      input.output.reorderSuggestions.length > 0
        ? input.output.reorderSuggestions
        : input.facts.reorderSuggestions,
    overstockProducts:
      input.output.overstockProducts.length > 0
        ? input.output.overstockProducts
        : input.facts.overstockProducts,
    understockProducts:
      input.output.understockProducts.length > 0
        ? input.output.understockProducts
        : input.facts.understockProducts,
    deadInventory:
      input.output.deadInventory.length > 0 ? input.output.deadInventory : input.facts.deadInventory,
    averageWeeksOfCover: input.facts.averageWeeksOfCover,
    averageSellThroughRate: input.facts.averageSellThroughRate,
    capitalLockedInInventory: input.facts.capitalLockedInInventory,
    fastMoverCount: input.facts.fastMoverCount,
    slowMoverCount: input.facts.slowMoverCount,
    priority: deriveInventoryOverallPriority(ranked),
    confidence: deriveInventoryOverallConfidence(ranked),
    healthExplanation: buildInventoryHealthExplanation(input.facts),
    recommendationGroups,
    recommendations: enrichedRecommendations,
  };
}

export function mutateAndEnrichInventoryIntelligenceOutput(input: {
  facts: InventoryFacts;
  output: InventoryIntelligenceOutput;
  executionContext?: InventoryIntelligenceExecutionContext;
}): InventoryIntelligenceEnrichedOutput {
  const enriched = enrichInventoryIntelligenceOutput(input);

  Object.assign(input.output, {
    priority: enriched.priority,
    confidence: enriched.confidence,
    healthExplanation: enriched.healthExplanation,
    recommendationGroups: enriched.recommendationGroups,
    recommendations: enriched.recommendations,
    inventoryHealthScore: enriched.inventoryHealthScore,
    deadStockCount: enriched.deadStockCount,
    stockoutAlertCount: enriched.stockoutAlertCount,
    overstockCount: enriched.overstockCount,
    understockCount: enriched.understockCount,
    averageDaysRemaining: enriched.averageDaysRemaining,
    stockAlerts: enriched.stockAlerts,
    reorderSuggestions: enriched.reorderSuggestions,
    overstockProducts: enriched.overstockProducts,
    understockProducts: enriched.understockProducts,
    deadInventory: enriched.deadInventory,
    averageWeeksOfCover: enriched.averageWeeksOfCover,
    averageSellThroughRate: enriched.averageSellThroughRate,
    capitalLockedInInventory: enriched.capitalLockedInInventory,
    fastMoverCount: enriched.fastMoverCount,
    slowMoverCount: enriched.slowMoverCount,
  });

  return enriched;
}
