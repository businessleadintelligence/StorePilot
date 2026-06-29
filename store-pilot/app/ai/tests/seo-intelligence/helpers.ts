import {
  createSeoIntelligenceFactsBuilder,
  type SeoIntelligenceFacts,
} from "../../facts/seo-intelligence-facts";
import { createMockUnifiedStoreMetricsForFacts } from "../../migration/unified-metrics-migration";
import {
  resolvePrimaryRuleForCategory,
  SEO_KNOWLEDGE_RULE_SET_VERSION,
} from "../../knowledge/seo-knowledge-layer";
import type { SeoIntelligenceOutput } from "../../schemas/seo-intelligence";
import type { SeoIntelligenceScores } from "../../tools/seo-intelligence-scores-tool";

export function buildMockSeoScores(overrides: Partial<SeoIntelligenceScores> = {}): SeoIntelligenceScores {
  return {
    seoScore: 78,
    technicalSeoScore: 74,
    contentScore: 68,
    indexabilityScore: 80,
    internalLinkingScore: 72,
    structuredDataScore: 85,
    coreWebVitalsScore: 83,
    performanceScore: 76,
    imageOptimizationScore: 82,
    accessibilityScore: 79,
    duplicateContentScore: 88,
    canonicalHealth: 74,
    headingStructureScore: 86,
    searchVisibilityScore: 65,
    organicOpportunityScore: 42,
    ...overrides,
  };
}

export function createMockSeoIntelligenceSnapshot(
  overrides: Partial<{
    storeName: string;
    activeProductCount: number;
    shortTitles: number;
    duplicateTitles: number;
    missingAltTextProxy: number;
    thinContentPages: number;
    missingSku: number;
    missingCollectionDescriptions: number;
    implementedRecommendationIds: string[];
    dismissedRecommendationIds: string[];
  }> = {},
) {
  const activeProductCount = overrides.activeProductCount ?? 12;
  const shortTitles = overrides.shortTitles ?? 2;
  const duplicateTitles = overrides.duplicateTitles ?? 0;
  const collectionCount = 4;
  const missingCollectionDescriptions = overrides.missingCollectionDescriptions ?? 1;
  const thinContentPages = overrides.thinContentPages ?? shortTitles + missingCollectionDescriptions;
  const missingAltTextProxy = overrides.missingAltTextProxy ?? 2;
  const missingSku = overrides.missingSku ?? 1;
  const indexedPagesProxy = Math.max(1, activeProductCount + collectionCount + 4 - duplicateTitles);
  const totalPagesProxy = indexedPagesProxy + 2;

  return {
    storeName: overrides.storeName ?? "Acme Outfitters",
    activeProductCount,
    shortTitles,
    duplicateTitles,
    missingAltTextProxy,
    thinContentPages,
    collectionCount,
    missingCollectionDescriptions,
    productsWithMetaTitle: Math.max(0, activeProductCount - shortTitles),
    productsWithMetaDescription: Math.max(0, activeProductCount - Math.floor(shortTitles * 1.2)),
    headingOrderIssues: duplicateTitles > 0 ? 1 : shortTitles > 3 ? 1 : 0,
    missingSku,
    structuredDataLikely: activeProductCount >= 3 && missingSku === 0,
    canonicalIssues: duplicateTitles + (missingSku > 0 ? 1 : 0),
    indexedPagesProxy,
    totalPagesProxy,
    webhookCount: 6,
    syncLatencyDays: 2,
    unifiedMetrics: createMockUnifiedStoreMetricsForFacts(),
    implementedRecommendationIds: overrides.implementedRecommendationIds ?? [],
    dismissedRecommendationIds: overrides.dismissedRecommendationIds ?? [],
  };
}

export async function buildSeoIntelligenceFactsFromSnapshot(
  snapshot = createMockSeoIntelligenceSnapshot(),
  storeId = "store-1",
): Promise<SeoIntelligenceFacts> {
  const builder = createSeoIntelligenceFactsBuilder({
    async getSeoIntelligenceSnapshot() {
      return snapshot;
    },
  });

  return builder.build({ storeId, agentId: "seo_audit" });
}

function ruleForCategory(category: string) {
  const rule = resolvePrimaryRuleForCategory(category);
  return {
    sourceRuleId: rule?.ruleId ?? "google-title-quality",
    sourceRuleVersion: rule?.ruleVersion ?? SEO_KNOWLEDGE_RULE_SET_VERSION,
  };
}

export function buildValidSeoIntelligenceDraft(
  facts: Pick<SeoIntelligenceFacts, "seoHealthScore">,
): SeoIntelligenceOutput {
  const metadataRule = ruleForCategory("Metadata");
  const imagesRule = ruleForCategory("Images");
  const technicalRule = ruleForCategory("Technical SEO");
  const structuredDataRule = ruleForCategory("Structured Data");

  return {
    summary:
      "The store has usable organic foundations, but metadata depth and image alt coverage are limiting search visibility.",
    priority: 2,
    confidence: 0.88,
    seoHealthScore: facts.seoHealthScore,
    technicalFindings: [
      {
        id: "seo-canonical-gap",
        category: "Technical SEO",
        title: "Canonical signals need cleanup",
        detail: "Duplicate or conflicting canonical patterns reduce index clarity across product pages.",
        severity: "medium",
        confidence: 0.84,
        ...technicalRule,
      },
    ],
    contentFindings: [
      {
        id: "seo-short-titles",
        category: "Metadata",
        title: "Several product titles are too short for search intent",
        detail: "Short titles weaken metadata coverage and reduce qualified click-through from search.",
        severity: "high",
        confidence: 0.9,
        ...metadataRule,
      },
    ],
    structuredDataFindings: [
      {
        id: "seo-structured-data-review",
        category: "Structured Data",
        title: "Structured data coverage should be validated on key templates",
        detail: "Product rich-result eligibility depends on valid structured data on revenue pages.",
        severity: "medium",
        confidence: 0.82,
        ...structuredDataRule,
      },
    ],
    recommendations: [
      {
        id: "seo:metadata-titles",
        category: "Metadata",
        title: "Expand short product titles with intent-rich metadata",
        reason:
          "Short titles leave metadata gaps that reduce search visibility and qualified click-through on product pages.",
        evidenceKeys: ["content_score", "seo_health_score", "content_issue_content_short_titles"],
        merchantAction: [
          "Rewrite product titles shorter than 20 characters with descriptive, intent-matching copy",
          "Add unique meta descriptions to priority product pages missing coverage",
        ],
        expectedResult: "Improve metadata coverage and organic click-through on product pages",
        estimatedImpact: "Lift search visibility on priority product URLs within one crawl cycle",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.9,
        verificationCriteria: "Content score improves after metadata updates are published",
        timeline: "1-2 weeks",
        ...metadataRule,
      },
      {
        id: "seo:image-alt-text",
        category: "Images",
        title: "Add descriptive alt text to product images missing coverage",
        reason:
          "Missing alt text reduces accessibility and image search visibility while weakening on-page relevance signals.",
        evidenceKeys: ["alt_text_coverage", "image_optimization_score", "seo_health_score"],
        merchantAction: [
          "Audit product images missing alt text and add descriptive, keyword-aware alt attributes",
          "Prioritize alt text on top-selling product pages first",
        ],
        expectedResult: "Improve image search visibility and accessibility coverage",
        estimatedImpact: "Recover image and accessibility SEO signals on high-traffic product pages",
        difficulty: "Medium",
        priority: 2,
        confidence: 0.87,
        verificationCriteria: "Alt text coverage increases after image updates",
        timeline: "2 weeks",
        ...imagesRule,
      },
    ],
    opportunities: ["Metadata quick wins can unlock visibility on existing catalog demand"],
    risks: ["Continued thin metadata may suppress non-branded organic growth"],
  };
}
