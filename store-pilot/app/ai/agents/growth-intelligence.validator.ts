import { AIPlatformError } from "../core/ai-errors";
import type { GrowthIntelligenceFacts } from "../facts/growth-intelligence-facts";
import {
  GROWTH_INTELLIGENCE_CATEGORIES,
  growthIntelligenceEnrichedSchema,
  type GrowthIntelligenceOutput,
} from "../schemas/growth-intelligence";
import { areGrowthRecommendationsSimilar } from "../tools/growth-similarity-tool";
import { getGrowthIntelligenceExecutionContext } from "./agent-execution-context";
import { mutateAndEnrichGrowthIntelligenceOutput } from "./growth-intelligence-enrichment";
import {
  buildGrowthIntelligenceEvidenceCatalog,
  sectionIssuesForCategory,
  sectionScoreForCategory,
  validateGrowthIntelligenceEvidenceKeys,
} from "./growth-intelligence-evidence";

const VAGUE_PATTERNS = [
  /^improve growth$/i,
  /^fix growth$/i,
  /^optimize growth$/i,
  /^grow revenue$/i,
  /^increase sales$/i,
  /^boost growth$/i,
];

export function isVagueGrowthRecommendationText(value: string): boolean {
  const normalized = value.trim();
  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function recommendationContradictsFacts(
  facts: GrowthIntelligenceFacts,
  recommendation: GrowthIntelligenceOutput["recommendations"][number],
): boolean {
  const sectionScore = sectionScoreForCategory(facts, recommendation.category);
  const issues = sectionIssuesForCategory(facts, recommendation.category);

  if (issues.length === 0 && sectionScore >= 92) {
    return true;
  }

  if (
    recommendation.category === "Upsell" &&
    facts.strategySignals.upsellCandidates === 0 &&
    facts.upsell.candidateCount === 0
  ) {
    return true;
  }

  if (recommendation.category === "Campaigns" && facts.strategySignals.campaignReadySegments === 0) {
    return true;
  }

  return false;
}

function findingContradictsFacts(
  facts: GrowthIntelligenceFacts,
  finding: GrowthIntelligenceOutput["findings"][number],
): boolean {
  const sectionScore = sectionScoreForCategory(facts, finding.category);
  return finding.severity === "critical" && sectionScore >= 85;
}

export function validateGrowthIntelligenceBusinessRules(
  facts: GrowthIntelligenceFacts,
  output: GrowthIntelligenceOutput,
): void {
  if (output.growthHealthScore !== facts.growthHealthScore) {
    throw AIPlatformError.businessRuleValidation("health_score_mismatch");
  }

  if (output.growthScore !== facts.growthScore) {
    throw AIPlatformError.businessRuleValidation("growth_score_mismatch");
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

    if (recommendationTitles.some((existing) => areGrowthRecommendationsSimilar(existing, recommendation))) {
      throw AIPlatformError.businessRuleValidation("duplicate_recommendation");
    }

    recommendationTitles.push({
      category: recommendation.category,
      title: recommendation.title,
    });

    if (!GROWTH_INTELLIGENCE_CATEGORIES.includes(recommendation.category)) {
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
      recommendation.priority < 1 ||
      recommendation.priority > 5 ||
      recommendation.confidence < 0 ||
      recommendation.confidence > 1
    ) {
      throw AIPlatformError.businessRuleValidation("invalid_priority_or_confidence");
    }

    if (
      isVagueGrowthRecommendationText(recommendation.title) ||
      isVagueGrowthRecommendationText(recommendation.reason) ||
      recommendation.merchantAction.some((action) => isVagueGrowthRecommendationText(action))
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
    if (!GROWTH_INTELLIGENCE_CATEGORIES.includes(finding.category)) {
      throw AIPlatformError.businessRuleValidation("unknown_section");
    }

    if (findingContradictsFacts(facts, finding)) {
      throw AIPlatformError.businessRuleValidation("contradictory_finding");
    }
  }

  const catalog =
    getGrowthIntelligenceExecutionContext()?.evidenceCatalog ??
    buildGrowthIntelligenceEvidenceCatalog(facts);

  for (const recommendation of output.recommendations) {
    try {
      validateGrowthIntelligenceEvidenceKeys(recommendation.evidenceKeys, catalog);
    } catch {
      throw AIPlatformError.businessRuleValidation("invalid_evidence_key");
    }
  }

  const executionContext = getGrowthIntelligenceExecutionContext();
  if (executionContext) {
    for (const recommendation of output.recommendations) {
      if (executionContext.recommendationMemory.implementedIds.has(recommendation.id)) {
        throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
      }
    }
  }

  const enriched = mutateAndEnrichGrowthIntelligenceOutput({
    facts,
    output,
    executionContext,
  });

  const parsed = growthIntelligenceEnrichedSchema.safeParse(enriched);
  if (!parsed.success) {
    throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
  }
}

export function extractGrowthIntelligenceRecommendations(output: GrowthIntelligenceOutput) {
  const executionContext = getGrowthIntelligenceExecutionContext();
  const recommendations = output.recommendations as Array<
    GrowthIntelligenceOutput["recommendations"][number] & {
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
