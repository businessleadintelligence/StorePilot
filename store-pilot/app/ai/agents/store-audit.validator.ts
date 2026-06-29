import { AIPlatformError } from "../core/ai-errors";
import type { StoreAuditFacts } from "../facts/store-audit-facts";
import {
  STORE_AUDIT_INTELLIGENCE_CATEGORIES,
  storeAuditIntelligenceEnrichedSchema,
  type StoreAuditIntelligenceOutput,
} from "../schemas/store-audit-intelligence";
import { areAuditRecommendationsSimilar } from "../tools/audit-similarity-tool";
import { getStoreAuditExecutionContext } from "./agent-execution-context";
import { mutateAndEnrichStoreAuditOutput } from "./store-audit-enrichment";
import {
  buildStoreAuditEvidenceCatalog,
  validateStoreAuditEvidenceKeys,
} from "./store-audit-evidence";

const VAGUE_PATTERNS = [
  /^improve homepage$/i,
  /^fix seo$/i,
  /^optimize store$/i,
  /^improve conversion$/i,
  /^update theme$/i,
];

export function isVagueStoreAuditRecommendationText(value: string): boolean {
  const normalized = value.trim();
  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sectionIssuesForCategory(facts: StoreAuditFacts, category: string): string[] {
  const mapping: Record<string, string[]> = {
    Homepage: facts.homepage.issues,
    "Store Performance": facts.storeSpeed.issues,
    Navigation: facts.navigation.issues,
    Collections: facts.collections.issues,
    "Product Pages": facts.productPages.issues,
    Theme: facts.theme.issues,
    Apps: facts.apps.issues,
    SEO: facts.seo.issues,
    "Technical SEO": facts.technicalSeo.issues,
    Images: facts.images.issues,
    "Trust Signals": facts.trust.issues,
    Policies: facts.policies.issues,
    Accessibility: facts.accessibility.issues,
    "Mobile UX": facts.mobileUx.issues,
    "Checkout Preparation": facts.conversion.issues,
    "Conversion Optimization": facts.conversion.issues,
    "Merchant Best Practices": facts.merchantBestPractices.issues,
  };

  return mapping[category] ?? [];
}

function sectionScoresForFacts(facts: StoreAuditFacts): Record<string, number> {
  return {
    Homepage: facts.homepageScore,
    "Store Performance": facts.performanceScore,
    Navigation: facts.navigationScore,
    Collections: facts.collections.score,
    "Product Pages": facts.productPages.score,
    Theme: facts.themeScore,
    Apps: facts.appBloatScore,
    SEO: facts.seoScore,
    "Technical SEO": facts.technicalSeoScore,
    Images: facts.imageOptimizationScore,
    "Trust Signals": facts.trustScore,
    Policies: facts.policyScore,
    Accessibility: facts.accessibilityScore,
    "Mobile UX": facts.mobileScore,
    "Checkout Preparation": facts.conversionScore,
    "Conversion Optimization": facts.conversionScore,
    "Merchant Best Practices": facts.merchantBestPracticesScore,
  };
}

function recommendationContradictsFacts(
  facts: StoreAuditFacts,
  recommendation: StoreAuditIntelligenceOutput["recommendations"][number],
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

  return false;
}

function findingContradictsFacts(
  facts: StoreAuditFacts,
  finding: StoreAuditIntelligenceOutput["findings"][number],
): boolean {
  const sectionScores = sectionScoresForFacts(facts);

  const sectionScore = sectionScores[finding.section];
  if (sectionScore === undefined) {
    return true;
  }

  return finding.severity === "critical" && sectionScore >= 85;
}

export function validateStoreAuditBusinessRules(
  facts: StoreAuditFacts,
  output: StoreAuditIntelligenceOutput,
): void {
  if (output.storeHealthScore !== facts.storeHealthScore) {
    throw AIPlatformError.businessRuleValidation("health_score_mismatch");
  }

  if (output.homepageScore !== facts.homepageScore) {
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
      recommendationTitles.some((existing) =>
        areAuditRecommendationsSimilar(existing, recommendation),
      )
    ) {
      throw AIPlatformError.businessRuleValidation("duplicate_recommendation");
    }

    recommendationTitles.push({
      category: recommendation.category,
      title: recommendation.title,
    });

    if (!STORE_AUDIT_INTELLIGENCE_CATEGORIES.includes(recommendation.category)) {
      throw AIPlatformError.businessRuleValidation("unknown_recommendation_category");
    }

    if (recommendation.evidenceKeys.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_evidence_keys");
    }

    if (recommendation.merchantAction.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_merchant_action");
    }

    if (
      isVagueStoreAuditRecommendationText(recommendation.title) ||
      isVagueStoreAuditRecommendationText(recommendation.reason) ||
      recommendation.merchantAction.some((action) => isVagueStoreAuditRecommendationText(action))
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
    if (!STORE_AUDIT_INTELLIGENCE_CATEGORIES.includes(finding.section)) {
      throw AIPlatformError.businessRuleValidation("unknown_section");
    }

    if (findingContradictsFacts(facts, finding)) {
      throw AIPlatformError.businessRuleValidation("contradictory_finding");
    }
  }

  const catalog =
    getStoreAuditExecutionContext()?.evidenceCatalog ?? buildStoreAuditEvidenceCatalog(facts);

  for (const recommendation of output.recommendations) {
    try {
      validateStoreAuditEvidenceKeys(recommendation.evidenceKeys, catalog);
    } catch {
      throw AIPlatformError.businessRuleValidation("invalid_evidence_key");
    }
  }

  const executionContext = getStoreAuditExecutionContext();
  if (executionContext) {
    for (const recommendation of output.recommendations) {
      if (executionContext.recommendationMemory.implementedIds.has(recommendation.id)) {
        throw AIPlatformError.businessRuleValidation("implemented_recommendation_regenerated");
      }
    }
  }

  const enriched = mutateAndEnrichStoreAuditOutput({
    facts,
    output,
    executionContext,
  });

  const parsed = storeAuditIntelligenceEnrichedSchema.safeParse(enriched);
  if (!parsed.success) {
    throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
  }
}

export function extractStoreAuditRecommendations(output: StoreAuditIntelligenceOutput) {
  const executionContext = getStoreAuditExecutionContext();
  const recommendations = output.recommendations as Array<
    StoreAuditIntelligenceOutput["recommendations"][number] & {
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
