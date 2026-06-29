import { AIPlatformError } from "../core/ai-errors";
import type { SeoIntelligenceFacts } from "../facts/seo-intelligence-facts";
import {
  SEO_INTELLIGENCE_CATEGORIES,
  seoIntelligenceEnrichedSchema,
  type SeoIntelligenceOutput,
} from "../schemas/seo-intelligence";
import { areSeoRecommendationsSimilar } from "../tools/seo-similarity-tool";
import { getSeoIntelligenceExecutionContext } from "./agent-execution-context";
import { mutateAndEnrichSeoIntelligenceOutput } from "./seo-intelligence-enrichment";
import {
  buildSeoIntelligenceEvidenceCatalog,
  validateSeoIntelligenceEvidenceKeys,
} from "./seo-intelligence-evidence";

const VAGUE_PATTERNS = [
  /^improve seo$/i,
  /^fix seo$/i,
  /^optimize seo$/i,
  /^improve metadata$/i,
  /^add seo$/i,
];

export function isVagueSeoRecommendationText(value: string): boolean {
  const normalized = value.trim();
  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sectionIssuesForCategory(facts: SeoIntelligenceFacts, category: string): string[] {
  const mapping: Record<string, string[]> = {
    "Technical SEO": facts.technical.issues,
    Content: facts.content.issues,
    Images: facts.images.issues,
    Collections: facts.content.issues,
    Products: facts.content.issues,
    Navigation: facts.internalLinking.issues,
    "Internal Linking": facts.internalLinking.issues,
    "Structured Data": facts.structuredData.issues,
    "Core Web Vitals": facts.coreWebVitals.issues,
    Indexability: facts.indexability.issues,
    Accessibility: facts.accessibility.issues,
    Schema: facts.structuredData.issues,
    Metadata: facts.content.issues,
    "Merchant Trust": [],
    "Conversion SEO": facts.organicOpportunity.issues,
  };

  return mapping[category] ?? [];
}

function sectionScoresForFacts(facts: SeoIntelligenceFacts): Record<string, number> {
  return {
    "Technical SEO": facts.scores.technicalSeoScore,
    Content: facts.scores.contentScore,
    Images: facts.scores.imageOptimizationScore,
    Collections: facts.scores.contentScore,
    Products: facts.scores.contentScore,
    Navigation: facts.scores.internalLinkingScore,
    "Internal Linking": facts.scores.internalLinkingScore,
    "Structured Data": facts.scores.structuredDataScore,
    "Core Web Vitals": facts.scores.coreWebVitalsScore,
    Indexability: facts.scores.indexabilityScore,
    Accessibility: facts.scores.accessibilityScore,
    Schema: facts.scores.structuredDataScore,
    Metadata: facts.scores.contentScore,
    "Merchant Trust": facts.scores.seoScore,
    "Conversion SEO": facts.scores.organicOpportunityScore,
  };
}

function recommendationContradictsFacts(
  facts: SeoIntelligenceFacts,
  recommendation: SeoIntelligenceOutput["recommendations"][number],
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

  if (!recommendation.sourceRuleId || !recommendation.sourceRuleVersion) {
    return true;
  }

  return false;
}

function findingContradictsFacts(
  facts: SeoIntelligenceFacts,
  finding: SeoIntelligenceOutput["technicalFindings"][number],
): boolean {
  const sectionScores = sectionScoresForFacts(facts);
  const sectionScore = sectionScores[finding.category];
  if (sectionScore === undefined) {
    return true;
  }

  return finding.severity === "critical" && sectionScore >= 85;
}

export function validateSeoIntelligenceBusinessRules(
  facts: SeoIntelligenceFacts,
  output: SeoIntelligenceOutput,
): void {
  if (output.seoHealthScore !== facts.seoHealthScore) {
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

    if (recommendationTitles.some((existing) => areSeoRecommendationsSimilar(existing, recommendation))) {
      throw AIPlatformError.businessRuleValidation("duplicate_recommendation");
    }

    recommendationTitles.push({
      category: recommendation.category,
      title: recommendation.title,
    });

    if (!SEO_INTELLIGENCE_CATEGORIES.includes(recommendation.category)) {
      throw AIPlatformError.businessRuleValidation("unknown_recommendation_category");
    }

    if (recommendation.evidenceKeys.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_evidence_keys");
    }

    if (recommendation.merchantAction.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_merchant_action");
    }

    if (!recommendation.sourceRuleId || !recommendation.sourceRuleVersion) {
      throw AIPlatformError.businessRuleValidation("missing_rule_version");
    }

    if (!recommendation.verificationCriteria?.trim()) {
      throw AIPlatformError.businessRuleValidation("missing_verification");
    }

    if (
      isVagueSeoRecommendationText(recommendation.title) ||
      isVagueSeoRecommendationText(recommendation.reason) ||
      recommendation.merchantAction.some((action) => isVagueSeoRecommendationText(action))
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

  for (const finding of [...output.technicalFindings, ...output.contentFindings, ...output.structuredDataFindings]) {
    if (!SEO_INTELLIGENCE_CATEGORIES.includes(finding.category)) {
      throw AIPlatformError.businessRuleValidation("unknown_section");
    }

    if (!finding.sourceRuleId || !finding.sourceRuleVersion) {
      throw AIPlatformError.businessRuleValidation("missing_rule_version");
    }

    if (findingContradictsFacts(facts, finding)) {
      throw AIPlatformError.businessRuleValidation("contradictory_finding");
    }
  }

  const catalog =
    getSeoIntelligenceExecutionContext()?.evidenceCatalog ?? buildSeoIntelligenceEvidenceCatalog(facts);

  for (const recommendation of output.recommendations) {
    try {
      validateSeoIntelligenceEvidenceKeys(recommendation.evidenceKeys, catalog);
    } catch {
      throw AIPlatformError.businessRuleValidation("invalid_evidence_key");
    }
  }

  const executionContext = getSeoIntelligenceExecutionContext();
  if (executionContext) {
    for (const recommendation of output.recommendations) {
      if (executionContext.recommendationMemory.implementedIds.has(recommendation.id)) {
        throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
      }
    }
  }

  const enriched = mutateAndEnrichSeoIntelligenceOutput({
    facts,
    output,
    executionContext,
  });

  const parsed = seoIntelligenceEnrichedSchema.safeParse(enriched);
  if (!parsed.success) {
    throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
  }
}

export function extractSeoIntelligenceRecommendations(output: SeoIntelligenceOutput) {
  const executionContext = getSeoIntelligenceExecutionContext();
  const recommendations = output.recommendations as Array<
    SeoIntelligenceOutput["recommendations"][number] & {
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
