import { AIPlatformError } from "../core/ai-errors";
import type { PricingIntelligenceFacts } from "../facts/pricing-intelligence-facts";
import {
  PRICING_INTELLIGENCE_CATEGORIES,
  pricingIntelligenceEnrichedSchema,
  type PricingIntelligenceOutput,
} from "../schemas/pricing-intelligence";
import { arePricingRecommendationsSimilar } from "../tools/pricing-similarity-tool";
import { getPricingIntelligenceExecutionContext } from "./agent-execution-context";
import { mutateAndEnrichPricingIntelligenceOutput } from "./pricing-intelligence-enrichment";
import {
  buildPricingIntelligenceEvidenceCatalog,
  validatePricingIntelligenceEvidenceKeys,
} from "./pricing-intelligence-evidence";

const VAGUE_PATTERNS = [
  /^improve pricing$/i,
  /^fix pricing$/i,
  /^optimize pricing$/i,
  /^adjust prices$/i,
  /^change pricing$/i,
];

export function isVaguePricingRecommendationText(value: string): boolean {
  const normalized = value.trim();
  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sectionIssuesForCategory(facts: PricingIntelligenceFacts, category: string): string[] {
  const mapping: Record<string, string[]> = {
    "Margin Protection": facts.margin.issues,
    "Discount Optimization": facts.discount.issues,
    "Premium Pricing": facts.premium.issues,
    "Inventory Pricing": facts.inventory.issues,
    "Bundle Pricing": facts.bundle.issues,
    "Psychological Pricing": facts.psychology.issues,
    "Price Consistency": facts.priceConsistency.issues,
    "Revenue Optimization": facts.revenue.issues,
    "Conversion Pricing": facts.conversion.issues,
    "Markdown Timing": facts.discount.issues,
    "Competitive Pricing": facts.competition.issues,
    "Loss Leader Strategy": facts.risk.issues,
  };

  return mapping[category] ?? [];
}

function sectionScoresForFacts(facts: PricingIntelligenceFacts): Record<string, number> {
  return {
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
}

function recommendationContradictsFacts(
  facts: PricingIntelligenceFacts,
  recommendation: PricingIntelligenceOutput["recommendations"][number],
): boolean {
  const sectionScores = sectionScoresForFacts(facts);
  const sectionScore = sectionScores[recommendation.category];

  if (sectionScore === undefined) {
    return true;
  }

  const issues = sectionIssuesForCategory(facts, recommendation.category);
  if (issues.length === 0 && sectionScore >= 92) {
    return true;
  }

  if (
    recommendation.category === "Premium Pricing" &&
    facts.strategySignals.premiumCandidates === 0 &&
    facts.premium.opportunityCount === 0
  ) {
    return true;
  }

  if (recommendation.category === "Loss Leader Strategy" && facts.strategySignals.lossLeaderCandidates === 0) {
    return true;
  }

  return false;
}

function findingContradictsFacts(
  facts: PricingIntelligenceFacts,
  finding: PricingIntelligenceOutput["findings"][number],
): boolean {
  const sectionScores = sectionScoresForFacts(facts);
  const sectionScore = sectionScores[finding.category];
  if (sectionScore === undefined) {
    return true;
  }

  return finding.severity === "critical" && sectionScore >= 85;
}

export function validatePricingIntelligenceBusinessRules(
  facts: PricingIntelligenceFacts,
  output: PricingIntelligenceOutput,
): void {
  if (output.pricingHealthScore !== facts.pricingHealthScore) {
    throw AIPlatformError.businessRuleValidation("health_score_mismatch");
  }

  if (output.recommendations.length === 0) {
    throw AIPlatformError.businessRuleValidation("empty_recommendations");
  }

  const recommendationIds = new Set<string>();
  const recommendationTitles: Array<{ category: string; title: string }> = [];

  for (const recommendation of output.recommendations) {
    if (recommendationIds.has(recommendation.id)) {
      throw AIPlatformError.businessRuleValidation("duplicate_recommendation_id");
    }

    recommendationIds.add(recommendation.id);

    if (
      recommendationTitles.some((existing) => arePricingRecommendationsSimilar(existing, recommendation))
    ) {
      throw AIPlatformError.businessRuleValidation("duplicate_recommendation");
    }

    recommendationTitles.push({
      category: recommendation.category,
      title: recommendation.title,
    });

    if (!PRICING_INTELLIGENCE_CATEGORIES.includes(recommendation.category)) {
      throw AIPlatformError.businessRuleValidation("unknown_recommendation_category");
    }

    if (recommendation.evidenceKeys.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_evidence_keys");
    }

    if (recommendation.merchantAction.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_merchant_action");
    }

    if (!recommendation.verificationCriteria?.trim()) {
      throw AIPlatformError.businessRuleValidation("missing_verification");
    }

    if (
      isVaguePricingRecommendationText(recommendation.title) ||
      isVaguePricingRecommendationText(recommendation.reason) ||
      recommendation.merchantAction.some((action) => isVaguePricingRecommendationText(action))
    ) {
      throw AIPlatformError.businessRuleValidation("vague_recommendation");
    }

    if (recommendationContradictsFacts(facts, recommendation)) {
      throw AIPlatformError.businessRuleValidation("recommendation_contradicts_facts");
    }

    if (facts.implementedRecommendationIds.includes(recommendation.id)) {
      throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
    }
  }

  for (const finding of output.findings) {
    if (!PRICING_INTELLIGENCE_CATEGORIES.includes(finding.category)) {
      throw AIPlatformError.businessRuleValidation("unknown_section");
    }

    if (findingContradictsFacts(facts, finding)) {
      throw AIPlatformError.businessRuleValidation("contradictory_finding");
    }
  }

  const catalog =
    getPricingIntelligenceExecutionContext()?.evidenceCatalog ??
    buildPricingIntelligenceEvidenceCatalog(facts);

  for (const recommendation of output.recommendations) {
    try {
      validatePricingIntelligenceEvidenceKeys(recommendation.evidenceKeys, catalog);
    } catch {
      throw AIPlatformError.businessRuleValidation("invalid_evidence_key");
    }
  }

  const executionContext = getPricingIntelligenceExecutionContext();
  if (executionContext) {
    for (const recommendation of output.recommendations) {
      if (executionContext.recommendationMemory.implementedIds.has(recommendation.id)) {
        throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
      }
    }
  }

  const enriched = mutateAndEnrichPricingIntelligenceOutput({
    facts,
    output,
    executionContext,
  });

  const parsed = pricingIntelligenceEnrichedSchema.safeParse(enriched);
  if (!parsed.success) {
    throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
  }
}

export function extractPricingIntelligenceRecommendations(output: PricingIntelligenceOutput) {
  const executionContext = getPricingIntelligenceExecutionContext();
  const recommendations = output.recommendations as Array<
    PricingIntelligenceOutput["recommendations"][number] & {
      priority?: number;
      priorityScore?: number;
      group?: string;
      tasks?: string[];
      recommendationTimeline?: Record<string, unknown>;
      evidence?: string[];
      verification?: Record<string, unknown>;
      estimatedImpactMetrics?: Record<string, unknown>;
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
