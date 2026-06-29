import type { PricingIntelligenceFacts } from "../facts/pricing-intelligence-facts";
import type {
  PricingIntelligenceEnrichedOutput,
  PricingIntelligenceOutput,
  PricingIntelligenceRecommendation,
  PricingIntelligenceRecommendationDraft,
} from "../schemas/pricing-intelligence";
import { buildPricingIntelligenceDeliverableFields } from "../schemas/pricing-intelligence";
import type { PricingIntelligenceExecutionContext } from "./agent-execution-context";
import {
  buildPricingIntelligenceEvidenceCatalog,
  resolvePricingIntelligenceEvidenceFromKeys,
  validatePricingIntelligenceEvidenceKeys,
} from "./pricing-intelligence-evidence";
import { estimatePricingRecommendationImpactForFacts } from "./pricing-intelligence-impact";
import {
  assignPricingRecommendationGroupFromImpact,
  buildPricingRecommendationGroups,
} from "./pricing-intelligence-groups";
import { buildPricingIntelligenceHealthExplanation } from "./pricing-intelligence-health";
import {
  buildPricingMerchantPreferenceProfile,
  derivePricingOverallConfidence,
  derivePricingOverallPriority,
  rankPricingIntelligenceRecommendations,
  type RankedPricingIntelligenceRecommendationDraft,
} from "./pricing-intelligence-ranking";
import { dedupeSimilarPricingRecommendations } from "../tools/pricing-similarity-tool";
import {
  estimatePricingProfitGain,
  estimatePricingRevenueGain,
} from "../tools/pricing-impact-tool";

const IMPLEMENTATION_TIME: Record<string, string> = {
  Easy: "1-3 days",
  Medium: "1-2 weeks",
  Hard: "3-6 weeks",
};

function buildVerification(
  facts: PricingIntelligenceFacts,
  recommendation: PricingIntelligenceRecommendationDraft,
) {
  if (recommendation.category === "Margin Protection" || recommendation.category === "Loss Leader Strategy") {
    return {
      expectedMetric: "Margin percent",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (recommendation.category === "Discount Optimization" || recommendation.category === "Markdown Timing") {
    return {
      expectedMetric: "Discount dependence",
      expectedDirection: "Decrease" as const,
      expectedWindow: "21 days",
    };
  }

  if (
    recommendation.category === "Revenue Optimization" ||
    recommendation.category === "Conversion Pricing" ||
    recommendation.category === "Bundle Pricing"
  ) {
    return {
      expectedMetric: "Average order value",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (facts.scores.marginPercent < 35) {
    return {
      expectedMetric: "Margin percent",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  return {
    expectedMetric: "Pricing health score",
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

function buildStrategyInsights(facts: PricingIntelligenceFacts) {
  return [
    {
      question: "Should high-velocity products be premium positioned?",
      answer:
        facts.strategySignals.premiumCandidates >= 2
          ? `${facts.strategySignals.premiumCandidates} products show premium positioning potential with strong demand and low discounting.`
          : "Premium positioning candidates are limited; focus on margin protection first.",
      confidence: facts.strategySignals.premiumCandidates >= 2 ? 0.86 : 0.62,
    },
    {
      question: "Are discounts hurting long-term profit?",
      answer:
        facts.discount.discountDependence > 40
          ? "Discount dependence is elevated and may be eroding pricing discipline."
          : "Discount dependence is manageable relative to current demand signals.",
      confidence: facts.discount.discountDependence > 40 ? 0.88 : 0.74,
    },
    {
      question: "Which products should never be discounted?",
      answer:
        facts.strategySignals.neverDiscountCandidates > 0
          ? `${facts.strategySignals.neverDiscountCandidates} products already convert well with minimal discounting.`
          : "No clear never-discount candidates were detected in the current catalog snapshot.",
      confidence: facts.strategySignals.neverDiscountCandidates > 0 ? 0.84 : 0.58,
    },
    {
      question: "Should prices be raised gradually or immediately?",
      answer:
        facts.strategySignals.immediateRaiseCandidates >= facts.strategySignals.gradualRaiseCandidates
          ? "Immediate raises are viable on fast movers with strong demand and low discounting."
          : "Gradual price increases are safer while conversion and discount signals stabilize.",
      confidence: 0.8,
    },
  ];
}

function sectionScoreForCategory(facts: PricingIntelligenceFacts, category: string): number {
  const mapping: Record<string, number> = {
    "Margin Protection": facts.margin.marginPercent,
    "Discount Optimization": facts.discount.score,
    "Premium Pricing": facts.premium.score,
    "Inventory Pricing": facts.inventory.score,
    "Bundle Pricing": facts.bundle.score,
    "Psychological Pricing": facts.psychology.score,
    "Price Consistency": facts.priceConsistency.priceConsistencyScore,
    "Revenue Optimization": Math.max(0, 100 - facts.revenue.revenueRisk),
    "Conversion Pricing": facts.conversion.score,
    "Markdown Timing": facts.discount.score,
    "Competitive Pricing": facts.competition.score,
    "Loss Leader Strategy": facts.strategySignals.lossLeaderCandidates > 0 ? 55 : 85,
  };

  return mapping[category] ?? facts.pricingHealthScore;
}

export function enrichPricingIntelligenceOutput(input: {
  facts: PricingIntelligenceFacts;
  output: PricingIntelligenceOutput;
  executionContext?: PricingIntelligenceExecutionContext;
  detectedAt?: string;
}): PricingIntelligenceEnrichedOutput {
  const catalog =
    input.executionContext?.evidenceCatalog ?? buildPricingIntelligenceEvidenceCatalog(input.facts);
  const detectedAt = input.detectedAt ?? input.facts.computedAt;
  const preferences = input.executionContext?.recommendationRecords
    ? buildPricingMerchantPreferenceProfile(input.executionContext.recommendationRecords)
    : undefined;

  for (const recommendation of input.output.recommendations) {
    validatePricingIntelligenceEvidenceKeys(recommendation.evidenceKeys, catalog);
  }

  const dedupedDrafts = dedupeSimilarPricingRecommendations(input.output.recommendations);
  const impacts = new Map(
    dedupedDrafts.map((recommendation) => [
      recommendation.id,
      estimatePricingRecommendationImpactForFacts(input.facts, recommendation),
    ]),
  );

  const ranked = rankPricingIntelligenceRecommendations({
    facts: input.facts,
    recommendations: dedupedDrafts,
    impacts,
    preferences,
  });

  const enrichedRecommendations: PricingIntelligenceRecommendation[] = ranked.map(
    (recommendation: RankedPricingIntelligenceRecommendationDraft, index) => {
      const impact = impacts.get(recommendation.id) ?? {};
      const group = assignPricingRecommendationGroupFromImpact({
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
        evidence: resolvePricingIntelligenceEvidenceFromKeys(recommendation.evidenceKeys, catalog),
        verification: buildVerification(input.facts, recommendation),
        group,
        recommendationTimeline: buildRecommendationTimeline({ detectedAt }),
        tasks: recommendation.merchantAction.map((action) => action.trim()).filter(Boolean),
        estimatedRevenueGain: estimatePricingRevenueGain(impact, sectionScore),
        estimatedProfitGain: estimatePricingProfitGain(impact, input.facts.scores.marginPercent),
        estimatedMarginImprovement: impact.marginImprovement ?? 0,
        estimatedRoi: impact.roi ?? 0,
        estimatedImplementationTime: IMPLEMENTATION_TIME[recommendation.difficulty] ?? "1-2 weeks",
      };
    },
  );

  const recommendationGroups = buildPricingRecommendationGroups(
    enrichedRecommendations.map((recommendation) => ({
      id: recommendation.id,
      group: recommendation.group,
    })),
  );

  const deliverableFields = buildPricingIntelligenceDeliverableFields({
    facts: input.facts,
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
    pricingHealthScore: input.facts.pricingHealthScore,
    priority: derivePricingOverallPriority(ranked.map((item) => item.priorityScore)),
    confidence: derivePricingOverallConfidence(ranked.map((item) => item.confidence)),
    healthExplanation: buildPricingIntelligenceHealthExplanation(input.facts),
    recommendationGroups,
    recommendations: enrichedRecommendations,
    strategyInsights: buildStrategyInsights(input.facts),
  };
}

export function mutateAndEnrichPricingIntelligenceOutput(input: {
  facts: PricingIntelligenceFacts;
  output: PricingIntelligenceOutput;
  executionContext?: PricingIntelligenceExecutionContext;
}): PricingIntelligenceEnrichedOutput {
  const enriched = enrichPricingIntelligenceOutput(input);

  Object.assign(input.output, {
    priority: enriched.priority,
    confidence: enriched.confidence,
    healthExplanation: enriched.healthExplanation,
    recommendationGroups: enriched.recommendationGroups,
    recommendations: enriched.recommendations,
    pricingHealthScore: enriched.pricingHealthScore,
    criticalPricingRisks: enriched.criticalPricingRisks,
    quickRevenueWins: enriched.quickRevenueWins,
    premiumOpportunities: enriched.premiumOpportunities,
    revenueOpportunity: enriched.revenueOpportunity,
    profitOpportunity: enriched.profitOpportunity,
    pricingTimeline: enriched.pricingTimeline,
    strategyInsights: enriched.strategyInsights,
  });

  return enriched;
}
