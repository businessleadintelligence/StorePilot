import type { StoreAuditFacts } from "../facts/store-audit-facts";
import type {
  StoreAuditIntelligenceEnrichedOutput,
  StoreAuditIntelligenceOutput,
  StoreAuditIntelligenceRecommendation,
  StoreAuditIntelligenceRecommendationDraft,
} from "../schemas/store-audit-intelligence";
import type { StoreAuditExecutionContext } from "./agent-execution-context";
import {
  buildStoreAuditEvidenceCatalog,
  resolveStoreAuditEvidenceFromKeys,
  validateStoreAuditEvidenceKeys,
} from "./store-audit-evidence";
import { estimateStoreAuditRecommendationImpactForFacts } from "./store-audit-impact";
import {
  assignStoreAuditRecommendationGroupFromImpact,
  buildStoreAuditRecommendationGroups,
} from "./store-audit-groups";
import { buildStoreAuditHealthExplanation } from "./store-audit-health";
import {
  buildStoreAuditMerchantPreferenceProfile,
  deriveAuditOverallConfidence,
  deriveAuditOverallPriority,
  rankStoreAuditRecommendations,
  type RankedStoreAuditRecommendationDraft,
} from "./store-audit-ranking";
import { dedupeSimilarStoreAuditRecommendations } from "./store-audit-similarity";
import { buildStoreAuditDeliverableFields } from "../schemas/store-audit";

function buildVerification(
  facts: StoreAuditFacts,
  recommendation: StoreAuditIntelligenceRecommendationDraft,
) {
  if (recommendation.category === "Apps" || recommendation.category === "Theme") {
    return {
      expectedMetric: "Performance score",
      expectedDirection: "Increase" as const,
      expectedWindow: "21 days",
    };
  }

  if (recommendation.category === "SEO") {
    return {
      expectedMetric: "SEO score",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (recommendation.category === "Accessibility") {
    return {
      expectedMetric: "Store health score",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (facts.conversionScore < 65) {
    return {
      expectedMetric: "Store health score",
      expectedDirection: "Increase" as const,
      expectedWindow: "14 days",
    };
  }

  return {
    expectedMetric: "Store health score",
    expectedDirection: "Increase" as const,
    expectedWindow: "21 days",
  };
}

function buildTasks(recommendation: StoreAuditIntelligenceRecommendationDraft): string[] {
  return recommendation.merchantAction.map((action) => action.trim()).filter(Boolean);
}

function buildRecommendationTimeline(input: {
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

export function enrichStoreAuditOutput(input: {
  facts: StoreAuditFacts;
  output: StoreAuditIntelligenceOutput;
  executionContext?: StoreAuditExecutionContext;
  detectedAt?: string;
}): StoreAuditIntelligenceEnrichedOutput {
  const catalog =
    input.executionContext?.evidenceCatalog ?? buildStoreAuditEvidenceCatalog(input.facts);
  const detectedAt = input.detectedAt ?? input.facts.computedAt;
  const preferences = input.executionContext?.recommendationRecords
    ? buildStoreAuditMerchantPreferenceProfile(input.executionContext.recommendationRecords)
    : undefined;

  for (const recommendation of input.output.recommendations) {
    validateStoreAuditEvidenceKeys(recommendation.evidenceKeys, catalog);
  }

  const dedupedDrafts = dedupeSimilarStoreAuditRecommendations(input.output.recommendations);
  const impacts = new Map(
    dedupedDrafts.map((recommendation) => [
      recommendation.id,
      estimateStoreAuditRecommendationImpactForFacts(input.facts, recommendation),
    ]),
  );

  const ranked = rankStoreAuditRecommendations({
    facts: input.facts,
    recommendations: dedupedDrafts,
    impacts,
    preferences,
  });

  const enrichedRecommendations: StoreAuditIntelligenceRecommendation[] = ranked.map(
    (recommendation: RankedStoreAuditRecommendationDraft, index) => {
      const impact = impacts.get(recommendation.id) ?? {};
      const group = assignStoreAuditRecommendationGroupFromImpact({
        category: recommendation.category,
        priorityScore: recommendation.priorityScore,
        impact,
      });

      return {
        ...recommendation,
        priority: Math.min(5, index + 1),
        priorityScore: recommendation.priorityScore,
        estimatedImpactMetrics: impact,
        evidence: resolveStoreAuditEvidenceFromKeys(recommendation.evidenceKeys, catalog),
        verification: buildVerification(input.facts, recommendation),
        group,
        recommendationTimeline: buildRecommendationTimeline({ detectedAt }),
        tasks: buildTasks(recommendation),
      };
    },
  );

  const recommendationGroups = buildStoreAuditRecommendationGroups(
    enrichedRecommendations.map((recommendation) => ({
      id: recommendation.id,
      group: recommendation.group,
    })),
  );

  return {
    ...input.output,
    ...buildStoreAuditDeliverableFields({
      storeHealthScore: input.facts.storeHealthScore,
      navigationScore: input.facts.navigationScore,
      trustScore: input.facts.trustScore,
      imageOptimizationScore: input.facts.imageOptimizationScore,
      technicalSeoScore: input.facts.technicalSeoScore,
      policyScore: input.facts.policyScore,
      appBloatScore: input.facts.appBloatScore,
      merchantBestPracticesScore: input.facts.merchantBestPracticesScore,
      recommendations: enrichedRecommendations.map((recommendation) => ({
        id: recommendation.id,
        title: recommendation.title,
        group: recommendation.group,
        priority: recommendation.priority,
      })),
      findings: input.output.findings.map((finding) => ({
        title: finding.title,
        severity: finding.severity,
      })),
    }),
    storeHealthScore: input.facts.storeHealthScore,
    homepageScore: input.facts.homepageScore,
    performanceScore: input.facts.performanceScore,
    seoScore: input.facts.seoScore,
    accessibilityScore: input.facts.accessibilityScore,
    conversionScore: input.facts.conversionScore,
    mobileScore: input.facts.mobileScore,
    themeScore: input.facts.themeScore,
    priority: deriveAuditOverallPriority(ranked.map((item) => item.priorityScore)),
    confidence: deriveAuditOverallConfidence(ranked.map((item) => item.confidence)),
    healthExplanation: buildStoreAuditHealthExplanation(input.facts),
    recommendationGroups,
    recommendations: enrichedRecommendations,
  };
}

export function mutateAndEnrichStoreAuditOutput(input: {
  facts: StoreAuditFacts;
  output: StoreAuditIntelligenceOutput;
  executionContext?: StoreAuditExecutionContext;
}): StoreAuditIntelligenceEnrichedOutput {
  const enriched = enrichStoreAuditOutput(input);

  Object.assign(input.output, {
    priority: enriched.priority,
    confidence: enriched.confidence,
    healthExplanation: enriched.healthExplanation,
    recommendationGroups: enriched.recommendationGroups,
    recommendations: enriched.recommendations,
    storeHealthScore: enriched.storeHealthScore,
    homepageScore: enriched.homepageScore,
    performanceScore: enriched.performanceScore,
    seoScore: enriched.seoScore,
    accessibilityScore: enriched.accessibilityScore,
    conversionScore: enriched.conversionScore,
    mobileScore: enriched.mobileScore,
    themeScore: enriched.themeScore,
  });

  return enriched;
}
