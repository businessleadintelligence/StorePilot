import type { SeoIntelligenceFacts } from "../facts/seo-intelligence-facts";
import type {
  SeoIntelligenceEnrichedOutput,
  SeoIntelligenceOutput,
  SeoIntelligenceRecommendation,
  SeoIntelligenceRecommendationDraft,
} from "../schemas/seo-intelligence";
import { buildSeoIntelligenceDeliverableFields } from "../schemas/seo-intelligence";
import type { SeoIntelligenceExecutionContext } from "./agent-execution-context";
import {
  buildSeoIntelligenceEvidenceCatalog,
  resolveSeoIntelligenceEvidenceFromKeys,
  validateSeoIntelligenceEvidenceKeys,
} from "./seo-intelligence-evidence";
import { estimateSeoRecommendationImpactForFacts } from "./seo-intelligence-impact";
import {
  assignSeoRecommendationGroupFromImpact,
  buildSeoRecommendationGroups,
} from "./seo-intelligence-groups";
import { buildSeoIntelligenceHealthExplanation } from "./seo-intelligence-health";
import {
  buildSeoMerchantPreferenceProfile,
  deriveSeoOverallConfidence,
  deriveSeoOverallPriority,
  rankSeoIntelligenceRecommendations,
  type RankedSeoIntelligenceRecommendationDraft,
} from "./seo-intelligence-ranking";
import { dedupeSimilarSeoRecommendations } from "../tools/seo-similarity-tool";
import {
  estimateSeoRevenueImpact,
  estimateSeoTrafficGain,
} from "../tools/seo-impact-tool";

const IMPLEMENTATION_TIME: Record<string, string> = {
  Easy: "1-3 days",
  Medium: "1-2 weeks",
  Hard: "3-6 weeks",
};

function buildVerification(
  facts: SeoIntelligenceFacts,
  recommendation: SeoIntelligenceRecommendationDraft,
) {
  if (recommendation.category === "Core Web Vitals") {
    return {
      expectedMetric: "Core Web Vitals score",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (recommendation.category === "Metadata" || recommendation.category === "Content") {
    return {
      expectedMetric: "Search visibility score",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (recommendation.category === "Technical SEO" || recommendation.category === "Indexability") {
    return {
      expectedMetric: "SEO health score",
      expectedDirection: "Increase" as const,
      expectedWindow: "21 days",
    };
  }

  if (facts.scores.searchVisibilityScore < 65) {
    return {
      expectedMetric: "Search visibility score",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  return {
    expectedMetric: "SEO health score",
    expectedDirection: "Increase" as const,
    expectedWindow: "21 days",
  };
}

function buildTasks(recommendation: SeoIntelligenceRecommendationDraft): string[] {
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

export function enrichSeoIntelligenceOutput(input: {
  facts: SeoIntelligenceFacts;
  output: SeoIntelligenceOutput;
  executionContext?: SeoIntelligenceExecutionContext;
  detectedAt?: string;
}): SeoIntelligenceEnrichedOutput {
  const catalog =
    input.executionContext?.evidenceCatalog ?? buildSeoIntelligenceEvidenceCatalog(input.facts);
  const detectedAt = input.detectedAt ?? input.facts.computedAt;
  const preferences = input.executionContext?.recommendationRecords
    ? buildSeoMerchantPreferenceProfile(input.executionContext.recommendationRecords)
    : undefined;

  for (const recommendation of input.output.recommendations) {
    validateSeoIntelligenceEvidenceKeys(recommendation.evidenceKeys, catalog);
  }

  const dedupedDrafts = dedupeSimilarSeoRecommendations(input.output.recommendations);
  const impacts = new Map(
    dedupedDrafts.map((recommendation) => [
      recommendation.id,
      estimateSeoRecommendationImpactForFacts(input.facts, recommendation),
    ]),
  );

  const ranked = rankSeoIntelligenceRecommendations({
    facts: input.facts,
    recommendations: dedupedDrafts,
    impacts,
    preferences,
  });

  const enrichedRecommendations: SeoIntelligenceRecommendation[] = ranked.map(
    (recommendation: RankedSeoIntelligenceRecommendationDraft, index) => {
      const impact = impacts.get(recommendation.id) ?? {};
      const group = assignSeoRecommendationGroupFromImpact({
        category: recommendation.category,
        priorityScore: recommendation.priorityScore,
        impact,
      });
      const sectionScore =
        recommendation.category === "Core Web Vitals"
          ? input.facts.scores.coreWebVitalsScore
          : input.facts.scores.contentScore;
      const estimatedTrafficGain = estimateSeoTrafficGain(impact, sectionScore);
      const estimatedRevenueImpact = estimateSeoRevenueImpact(estimatedTrafficGain);

      return {
        ...recommendation,
        priority: Math.min(5, index + 1),
        priorityScore: recommendation.priorityScore,
        estimatedImpactMetrics: impact,
        evidence: resolveSeoIntelligenceEvidenceFromKeys(recommendation.evidenceKeys, catalog),
        verification: buildVerification(input.facts, recommendation),
        group,
        recommendationTimeline: buildRecommendationTimeline({ detectedAt }),
        tasks: buildTasks(recommendation),
        estimatedTrafficGain,
        estimatedRevenueImpact,
        estimatedImplementationTime: IMPLEMENTATION_TIME[recommendation.difficulty] ?? "1-2 weeks",
      };
    },
  );

  const recommendationGroups = buildSeoRecommendationGroups(
    enrichedRecommendations.map((recommendation) => ({
      id: recommendation.id,
      group: recommendation.group,
    })),
  );

  return {
    ...input.output,
    ...buildSeoIntelligenceDeliverableFields({
      facts: input.facts,
      recommendations: enrichedRecommendations.map((recommendation) => ({
        id: recommendation.id,
        title: recommendation.title,
        group: recommendation.group,
        priority: recommendation.priority,
      })),
      technicalFindings: input.output.technicalFindings,
      contentFindings: input.output.contentFindings,
    }),
    seoHealthScore: input.facts.seoHealthScore,
    priority: deriveSeoOverallPriority(ranked.map((item) => item.priorityScore)),
    confidence: deriveSeoOverallConfidence(ranked.map((item) => item.confidence)),
    healthExplanation: buildSeoIntelligenceHealthExplanation(input.facts),
    recommendationGroups,
    recommendations: enrichedRecommendations,
  };
}

export function mutateAndEnrichSeoIntelligenceOutput(input: {
  facts: SeoIntelligenceFacts;
  output: SeoIntelligenceOutput;
  executionContext?: SeoIntelligenceExecutionContext;
}): SeoIntelligenceEnrichedOutput {
  const enriched = enrichSeoIntelligenceOutput(input);

  Object.assign(input.output, {
    priority: enriched.priority,
    confidence: enriched.confidence,
    healthExplanation: enriched.healthExplanation,
    recommendationGroups: enriched.recommendationGroups,
    recommendations: enriched.recommendations,
    seoHealthScore: enriched.seoHealthScore,
    criticalIssues: enriched.criticalIssues,
    quickWins: enriched.quickWins,
    longTermOpportunities: enriched.longTermOpportunities,
    trafficOpportunity: enriched.trafficOpportunity,
    visibilityOpportunity: enriched.visibilityOpportunity,
    seoTimeline: enriched.seoTimeline,
  });

  return enriched;
}
