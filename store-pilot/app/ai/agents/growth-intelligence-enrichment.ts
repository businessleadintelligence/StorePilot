import type { GrowthIntelligenceFacts } from "../facts/growth-intelligence-facts";
import type {
  GrowthIntelligenceEnrichedOutput,
  GrowthIntelligenceOutput,
  GrowthIntelligenceRecommendation,
  GrowthIntelligenceRecommendationDraft,
} from "../schemas/growth-intelligence";
import { buildGrowthIntelligenceDeliverableFields } from "../schemas/growth-intelligence";
import type { GrowthIntelligenceExecutionContext } from "./agent-execution-context";
import {
  buildGrowthIntelligenceEvidenceCatalog,
  resolveGrowthIntelligenceEvidenceFromKeys,
  sectionScoreForCategory,
  validateGrowthIntelligenceEvidenceKeys,
} from "./growth-intelligence-evidence";
import { estimateGrowthRecommendationImpactForFacts } from "./growth-intelligence-impact";
import {
  assignGrowthRecommendationGroupFromImpact,
  buildGrowthRecommendationGroups,
} from "./growth-intelligence-groups";
import { buildGrowthIntelligenceHealthExplanation } from "./growth-intelligence-health";
import {
  buildGrowthMerchantPreferenceProfile,
  deriveGrowthOverallConfidence,
  deriveGrowthOverallPriority,
  rankGrowthIntelligenceRecommendations,
  type RankedGrowthIntelligenceRecommendationDraft,
} from "./growth-intelligence-ranking";
import { dedupeSimilarGrowthRecommendations } from "../tools/growth-similarity-tool";
import {
  estimateGrowthAovLift,
  estimateGrowthProfitGain,
  estimateGrowthRetentionLift,
  estimateGrowthRevenueGain,
} from "../tools/growth-impact-tool";

const IMPLEMENTATION_TIME: Record<string, string> = {
  Easy: "1-3 days",
  Medium: "1-2 weeks",
  Hard: "3-6 weeks",
};

function buildVerification(
  facts: GrowthIntelligenceFacts,
  recommendation: GrowthIntelligenceRecommendationDraft,
) {
  if (recommendation.category === "Retention" || recommendation.category === "Customer Lifetime Value") {
    return {
      expectedMetric: "Retention score",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (recommendation.category === "Revenue Growth" || recommendation.category === "Seasonal Growth") {
    return {
      expectedMetric: "Revenue growth rate",
      expectedDirection: "Increase" as const,
      expectedWindow: "21 days",
    };
  }

  if (
    recommendation.category === "AOV Growth" ||
    recommendation.category === "Upsell" ||
    recommendation.category === "Cross-sell"
  ) {
    return {
      expectedMetric: "Average order value",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (recommendation.category === "Landing Pages" || recommendation.category === "Campaigns") {
    return {
      expectedMetric: "Conversion rate proxy",
      expectedDirection: "Increase" as const,
      expectedWindow: "21 days",
    };
  }

  if (facts.scores.retentionScore < 55) {
    return {
      expectedMetric: "Retention score",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  return {
    expectedMetric: "Growth health score",
    expectedDirection: "Increase" as const,
    expectedWindow: "21 days",
  };
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

function buildStrategyInsights(facts: GrowthIntelligenceFacts) {
  return [
    {
      question: "Should the merchant prioritize AOV or retention first?",
      answer:
        facts.upsell.upsellOpportunity >= facts.retention.retentionScore
          ? "AOV expansion levers are stronger than retention stabilization in the current snapshot."
          : "Retention should be stabilized before scaling acquisition or campaign spend.",
      confidence: 0.84,
    },
    {
      question: "Are cross-sell opportunities ready to deploy?",
      answer:
        facts.strategySignals.crossSellPairs >= 2
          ? `${facts.strategySignals.crossSellPairs} complementary product pairs can lift basket size quickly.`
          : "Cross-sell pairs are limited; focus on hero product merchandising first.",
      confidence: facts.strategySignals.crossSellPairs >= 2 ? 0.86 : 0.62,
    },
    {
      question: "Is the store ready for a growth campaign push?",
      answer:
        facts.campaigns.campaignReadinessScore >= 65
          ? "Campaign readiness, landing pages, and inventory coverage support a near-term push."
          : "Fix landing page and capacity gaps before increasing paid or promotional spend.",
      confidence: facts.campaigns.campaignReadinessScore >= 65 ? 0.88 : 0.74,
    },
    {
      question: "Which growth motion should run first?",
      answer:
        facts.strategySignals.immediateWinCount >= facts.strategySignals.strategicOpportunityCount
          ? "Immediate wins in upsell, cross-sell, and merchandising can monetize existing demand faster."
          : "Strategic collection and campaign investments should lead while quick wins stabilize revenue.",
      confidence: 0.8,
    },
  ];
}

export function enrichGrowthIntelligenceOutput(input: {
  facts: GrowthIntelligenceFacts;
  output: GrowthIntelligenceOutput;
  executionContext?: GrowthIntelligenceExecutionContext;
  detectedAt?: string;
}): GrowthIntelligenceEnrichedOutput {
  const catalog =
    input.executionContext?.evidenceCatalog ?? buildGrowthIntelligenceEvidenceCatalog(input.facts);
  const detectedAt = input.detectedAt ?? input.facts.computedAt;
  const preferences = input.executionContext?.recommendationRecords
    ? buildGrowthMerchantPreferenceProfile(input.executionContext.recommendationRecords)
    : undefined;

  for (const recommendation of input.output.recommendations) {
    validateGrowthIntelligenceEvidenceKeys(recommendation.evidenceKeys, catalog);
  }

  const dedupedDrafts = dedupeSimilarGrowthRecommendations(input.output.recommendations);
  const impacts = new Map(
    dedupedDrafts.map((recommendation) => [
      recommendation.id,
      estimateGrowthRecommendationImpactForFacts(input.facts, recommendation),
    ]),
  );

  const ranked = rankGrowthIntelligenceRecommendations({
    facts: input.facts,
    recommendations: dedupedDrafts,
    impacts,
    preferences,
  });

  const enrichedRecommendations: GrowthIntelligenceRecommendation[] = ranked.map(
    (recommendation: RankedGrowthIntelligenceRecommendationDraft, index) => {
      const impact = impacts.get(recommendation.id) ?? {};
      const group = assignGrowthRecommendationGroupFromImpact({
        category: recommendation.category,
        priorityScore: recommendation.priorityScore,
        impact,
      });
      const sectionScore = sectionScoreForCategory(input.facts, recommendation.category);

      return {
        ...recommendation,
        priority: Math.min(5, index + 1),
        priorityScore: recommendation.priorityScore,
        estimatedImpactMetrics: impact,
        evidence: resolveGrowthIntelligenceEvidenceFromKeys(recommendation.evidenceKeys, catalog),
        verification: buildVerification(input.facts, recommendation),
        group,
        recommendationTimeline: buildRecommendationTimeline({ detectedAt }),
        tasks: recommendation.merchantAction.map((action) => action.trim()).filter(Boolean),
        estimatedRevenueGain: estimateGrowthRevenueGain(impact, sectionScore),
        estimatedProfitGain: estimateGrowthProfitGain(impact, input.facts.retention.retentionScore),
        estimatedAovLift: estimateGrowthAovLift(impact, input.facts.aov.score),
        estimatedRetentionLift: estimateGrowthRetentionLift(impact, input.facts.retention.retentionScore),
        estimatedImplementationTime: IMPLEMENTATION_TIME[recommendation.difficulty] ?? "1-2 weeks",
      };
    },
  );

  const recommendationGroups = buildGrowthRecommendationGroups(
    enrichedRecommendations.map((recommendation) => ({
      id: recommendation.id,
      group: recommendation.group,
    })),
  );

  const deliverableFields = buildGrowthIntelligenceDeliverableFields({
    facts: {
      growthScore: input.facts.growthScore,
      revenueOpportunity: input.facts.revenueOpportunity,
      aovOpportunity: input.facts.aovOpportunity,
    },
    recommendations: enrichedRecommendations.map((recommendation) => ({
      id: recommendation.id,
      title: recommendation.title,
      group: recommendation.group,
      priority: recommendation.priority,
    })),
    findings: input.output.findings,
  });

  return {
    ...input.output,
    ...deliverableFields,
    growthHealthScore: input.facts.growthHealthScore,
    growthScore: input.facts.growthScore,
    expectedRevenueLift: input.facts.revenueOpportunity,
    expectedProfitLift: input.facts.aovOpportunity,
    priority: deriveGrowthOverallPriority(ranked.map((item) => item.priorityScore)),
    confidence: deriveGrowthOverallConfidence(ranked.map((item) => item.confidence)),
    healthExplanation: buildGrowthIntelligenceHealthExplanation(input.facts),
    recommendationGroups,
    recommendations: enrichedRecommendations,
    strategyInsights: buildStrategyInsights(input.facts),
  };
}

export function mutateAndEnrichGrowthIntelligenceOutput(input: {
  facts: GrowthIntelligenceFacts;
  output: GrowthIntelligenceOutput;
  executionContext?: GrowthIntelligenceExecutionContext;
}): GrowthIntelligenceEnrichedOutput {
  const enriched = enrichGrowthIntelligenceOutput(input);

  Object.assign(input.output, {
    priority: enriched.priority,
    confidence: enriched.confidence,
    growthHealthScore: enriched.growthHealthScore,
    healthExplanation: enriched.healthExplanation,
    recommendationGroups: enriched.recommendationGroups,
    recommendations: enriched.recommendations,
    growthScore: enriched.growthScore,
    expectedRevenueLift: enriched.expectedRevenueLift,
    expectedProfitLift: enriched.expectedProfitLift,
    criticalGrowthRisks: enriched.criticalGrowthRisks,
    quickGrowthWins: enriched.quickGrowthWins,
    expansionOpportunities: enriched.expansionOpportunities,
    revenueOpportunity: enriched.revenueOpportunity,
    aovOpportunity: enriched.aovOpportunity,
    campaignTimeline: enriched.campaignTimeline,
    strategyInsights: enriched.strategyInsights,
  });

  return enriched;
}
