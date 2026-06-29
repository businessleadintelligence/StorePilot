import type { BundleFacts } from "../facts/bundle-facts";
import type {
  BundleIntelligenceEnrichedOutput,
  BundleIntelligenceOutput,
  BundleIntelligenceRecommendation,
  BundleIntelligenceRecommendationDraft,
} from "../schemas/bundle-intelligence";
import type { BundleDiscoveryExecutionContext } from "./agent-execution-context";
import {
  buildBundleEvidenceCatalog,
  resolveBundleEvidenceFromKeys,
  validateBundleEvidenceKeys,
} from "./bundle-discovery-evidence";
import { estimateBundleRecommendationImpactForFacts } from "./bundle-discovery-impact";
import {
  assignBundleRecommendationGroup,
  buildBundleRecommendationGroups,
} from "./bundle-discovery-groups";
import { buildBundleHealthExplanation } from "./bundle-discovery-health";
import {
  buildBundleMerchantPreferenceProfile,
  deriveBundleOverallConfidence,
  deriveBundleOverallPriority,
  rankBundleRecommendations,
  type RankedBundleRecommendationDraft,
} from "./bundle-discovery-ranking";
import { dedupeSimilarBundleRecommendations } from "./bundle-discovery-similarity";

function bundleTypeToCategory(bundleType: string): string {
  const mapping: Record<string, string> = {
    starter_kit: "Starter Kit",
    accessory_bundle: "Accessory Bundle",
    quantity_bundle: "Quantity Bundle",
    seasonal_bundle: "Seasonal Bundle",
    dead_inventory_bundle: "Dead Inventory Bundle",
    high_margin_bundle: "High Margin Bundle",
    merchandising_bundle: "Merchandising",
  };

  return mapping[bundleType] ?? "Merchandising";
}

function buildVerification(
  facts: BundleFacts,
  recommendation: BundleIntelligenceRecommendationDraft,
) {
  if (recommendation.category === "Dead Inventory Bundle") {
    return {
      expectedMetric: "Dead inventory units",
      expectedDirection: "Decrease" as const,
      expectedWindow: "30 days",
    };
  }

  if (recommendation.category === "High Margin Bundle") {
    return {
      expectedMetric: "Bundle attach rate",
      expectedDirection: "Increase" as const,
      expectedWindow: "21 days",
    };
  }

  const candidate = facts.bundleCandidates.find((item) => item.id === recommendation.id);
  if (candidate && candidate.expectedInventoryReduction > 0) {
    return {
      expectedMetric: "Inventory units reduced",
      expectedDirection: "Decrease" as const,
      expectedWindow: "30 days",
    };
  }

  return {
    expectedMetric: "Bundle attach rate",
    expectedDirection: "Increase" as const,
    expectedWindow: "14 days",
  };
}

function buildTasks(recommendation: BundleIntelligenceRecommendationDraft): string[] {
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

export function enrichBundleDiscoveryOutput(input: {
  facts: BundleFacts;
  output: BundleIntelligenceOutput;
  executionContext?: BundleDiscoveryExecutionContext;
  detectedAt?: string;
}): BundleIntelligenceEnrichedOutput {
  const catalog =
    input.executionContext?.evidenceCatalog ?? buildBundleEvidenceCatalog(input.facts);
  const detectedAt = input.detectedAt ?? input.facts.computedAt;
  const preferences = input.executionContext?.recommendationRecords
    ? buildBundleMerchantPreferenceProfile(input.executionContext.recommendationRecords)
    : undefined;

  for (const recommendation of input.output.recommendations) {
    validateBundleEvidenceKeys(recommendation.evidenceKeys, catalog);
  }

  const dedupedDrafts = dedupeSimilarBundleRecommendations(input.output.recommendations);
  const impacts = new Map(
    dedupedDrafts.map((recommendation) => [
      recommendation.id,
      estimateBundleRecommendationImpactForFacts(input.facts, recommendation),
    ]),
  );

  const ranked = rankBundleRecommendations({
    facts: input.facts,
    recommendations: dedupedDrafts,
    impacts,
    preferences,
  });

  const enrichedRecommendations: BundleIntelligenceRecommendation[] = ranked.map(
    (recommendation: RankedBundleRecommendationDraft, index) => {
      const impact = impacts.get(recommendation.id) ?? {};
      const candidate = input.facts.bundleCandidates.find((item) => item.id === recommendation.id);
      const group = assignBundleRecommendationGroup({
        category: recommendation.category,
        priorityScore: recommendation.priorityScore,
        bundleType: candidate?.bundleType ?? "merchandising_bundle",
      });

      return {
        ...recommendation,
        priority: Math.min(5, index + 1),
        priorityScore: recommendation.priorityScore,
        estimatedImpact: impact,
        evidence: resolveBundleEvidenceFromKeys(recommendation.evidenceKeys, catalog),
        verification: buildVerification(input.facts, recommendation),
        group,
        timeline: buildTimeline({ detectedAt }),
        tasks: buildTasks(recommendation),
        expectedImpact: recommendation.businessImpact,
      };
    },
  );

  const recommendationGroups = buildBundleRecommendationGroups(
    enrichedRecommendations.map((recommendation) => ({
      id: recommendation.id,
      group: recommendation.group,
    })),
  );

  return {
    ...input.output,
    bundleHealthScore: input.facts.bundleHealthScore,
    potentialAttachRate: input.facts.potentialAttachRate,
    potentialInventoryReduction: input.facts.potentialInventoryReduction,
    bundleSuccessRate: input.facts.bundleSuccessRate,
    bundleCandidates:
      input.output.bundleCandidates.length > 0
        ? input.output.bundleCandidates
        : input.facts.bundleCandidates.map((candidate) => ({
            id: candidate.id,
            productIds: candidate.productIds,
            titles: candidate.titles,
            bundleType: candidate.bundleType,
            confidence: candidate.confidence,
            attachRate: candidate.attachRate,
            complexity: candidate.complexity,
            inventoryCompatible: candidate.inventoryCompatible,
            expectedInventoryReduction: candidate.expectedInventoryReduction,
            potentialAttachRate: candidate.potentialAttachRate,
          })),
    priority: deriveBundleOverallPriority(ranked),
    confidence: deriveBundleOverallConfidence(ranked),
    healthExplanation: buildBundleHealthExplanation(input.facts),
    recommendationGroups,
    recommendations: enrichedRecommendations,
  };
}

export function mutateAndEnrichBundleDiscoveryOutput(input: {
  facts: BundleFacts;
  output: BundleIntelligenceOutput;
  executionContext?: BundleDiscoveryExecutionContext;
}): BundleIntelligenceEnrichedOutput {
  const enriched = enrichBundleDiscoveryOutput(input);

  Object.assign(input.output, {
    priority: enriched.priority,
    confidence: enriched.confidence,
    healthExplanation: enriched.healthExplanation,
    recommendationGroups: enriched.recommendationGroups,
    recommendations: enriched.recommendations,
    bundleHealthScore: enriched.bundleHealthScore,
    potentialAttachRate: enriched.potentialAttachRate,
    potentialInventoryReduction: enriched.potentialInventoryReduction,
    bundleSuccessRate: enriched.bundleSuccessRate,
    bundleCandidates: enriched.bundleCandidates,
  });

  return enriched;
}

export { bundleTypeToCategory };
