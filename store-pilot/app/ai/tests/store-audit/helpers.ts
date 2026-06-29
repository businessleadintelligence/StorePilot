import type { StoreAuditFacts } from "../../facts/store-audit-facts";
import { createMockUnifiedStoreMetricsForFacts } from "../../migration/unified-metrics-migration";
import type { StoreAuditIntelligenceOutput } from "../../schemas/store-audit-intelligence";

export function createMockStoreAuditSnapshot(
  overrides: Partial<{
    storeName: string;
    activeProductCount: number;
    recentOrderCount: number;
    hasCompletedOnboarding: boolean;
    shortTitles: number;
    missingSku: number;
  }> = {},
) {
  return {
    storeName: overrides.storeName ?? "Acme Outfitters",
    activeProductCount: overrides.activeProductCount ?? 12,
    draftProductCount: 1,
    recentOrderCount: overrides.recentOrderCount ?? 3,
    averageOrderValue: 58,
    hasCompletedOnboarding: overrides.hasCompletedOnboarding ?? true,
    shortTitles: overrides.shortTitles ?? 2,
    missingPrice: 0,
    missingSku: overrides.missingSku ?? 1,
    averageTitleLength: 28,
    collectionCount: 4,
    emptyCollections: 0,
    missingCollectionDescriptions: 1,
    duplicateCollectionTitles: 0,
    missingCollectionImages: 1,
    webhookCount: 6,
    duplicateWebhookTopics: 0,
    staleWebhookCount: 0,
    syncLatencyDays: 2,
    productsWithoutDescriptiveTitles: 1,
    headingOrderIssues: 0,
    missingAltTextProxy: 2,
    duplicateTitles: 0,
    productsWithLongTitles: 8,
    implementedRecommendationIds: [] as string[],
    dismissedRecommendationIds: [] as string[],
    unifiedMetrics: createMockUnifiedStoreMetricsForFacts(),
  };
}

export function buildStoreAuditFactsFromSnapshot(
  snapshot = createMockStoreAuditSnapshot(),
  storeId = "store-1",
): StoreAuditFacts {
  return {
    storeId,
    storeName: snapshot.storeName,
    computedAt: "2026-06-20T10:00:00.000Z",
    storeHealthScore: 74,
    overallAuditScore: 74,
    homepageScore: 78,
    performanceScore: 72,
    navigationScore: 75,
    seoScore: 76,
    technicalSeoScore: 74,
    accessibilityScore: 71,
    conversionScore: 69,
    mobileScore: 73,
    themeScore: 70,
    imageOptimizationScore: 72,
    trustScore: 68,
    policyScore: 85,
    appBloatScore: 74,
    merchantBestPracticesScore: 77,
    criticalIssueCount: 4,
    homepage: {
      score: 78,
      issues: ["homepage_missing_social_proof"],
      signals: {
        hasHeroContent: true,
        hasValueProposition: true,
        hasPrimaryCta: true,
        hasSecondaryCta: true,
        hasTrustBadges: true,
        hasSocialProof: false,
        hasAnnouncementBar: true,
        bannerHierarchyScore: 85,
        aboveFoldScore: 80,
      },
    },
    navigation: {
      score: 75,
      issues: [],
      menuDepth: 3,
      searchAvailable: true,
      footerComplete: true,
    },
    collections: {
      score: 66,
      issues: ["collection_missing_description"],
      collectionCount: snapshot.collectionCount,
      emptyCollections: snapshot.emptyCollections,
      missingDescriptions: snapshot.missingCollectionDescriptions,
    },
    productPages: {
      score: 68,
      issues: ["product_short_title", "product_missing_sku"],
      totalProducts: snapshot.activeProductCount,
      shortTitles: snapshot.shortTitles,
      missingPrice: snapshot.missingPrice,
      missingSku: snapshot.missingSku,
    },
    theme: {
      score: 70,
      issues: [],
      jsBundleRisk: false,
      imageOptimizationScore: 75,
    },
    apps: {
      score: 74,
      issues: [],
      installedApps: snapshot.webhookCount,
      unusedApps: snapshot.staleWebhookCount,
      duplicateApps: snapshot.duplicateWebhookTopics,
      recommendations: [{ label: "Core integrations", action: "keep" }],
    },
    seo: {
      score: 76,
      issues: ["seo_short_titles"],
      titleCoverage: 84,
      descriptionCoverage: 67,
      structuredDataLikely: true,
    },
    accessibility: {
      score: 71,
      issues: ["accessibility_missing_alt_text"],
      altTextCoverage: 83,
    },
    mobileUx: {
      score: 73,
      issues: [],
      touchTargetScore: 75,
      stickyCtaLikely: true,
    },
    conversion: {
      score: 69,
      issues: ["conversion_missing_social_proof"],
      cartFrictionScore: 80,
      socialProofScore: 60,
      upsellVisibility: 60,
    },
    performance: {
      score: 72,
      issues: [],
      themeScore: 70,
      appScore: 74,
    },
    images: {
      score: 72,
      issues: ["images_missing_alt_text"],
      altTextCoverage: 83,
      optimizationScore: 75,
    },
    trust: {
      score: 68,
      issues: ["trust_missing_social_proof"],
      socialProofReady: false,
      policyReady: true,
    },
    policies: {
      score: 85,
      issues: [],
      refundPolicyLikely: true,
      shippingPolicyLikely: true,
      privacyPolicyLikely: true,
    },
    technicalSeo: {
      score: 74,
      issues: [],
      canonicalRisk: false,
      sitemapLikely: true,
      structuredDataLikely: true,
    },
    merchantBestPractices: {
      score: 77,
      issues: ["merchant_short_titles"],
      catalogComplete: false,
      onboardingComplete: true,
    },
    storeSpeed: {
      score: 76,
      issues: [],
      estimatedPageWeightRisk: false,
      syncLatencyRisk: false,
    },
    implementedRecommendationIds: snapshot.implementedRecommendationIds,
    dismissedRecommendationIds: snapshot.dismissedRecommendationIds,
  };
}

export function buildValidStoreAuditDraft(
  facts: Pick<
    StoreAuditFacts,
    | "storeHealthScore"
    | "homepageScore"
    | "performanceScore"
    | "seoScore"
    | "accessibilityScore"
    | "conversionScore"
    | "mobileScore"
    | "themeScore"
  >,
): StoreAuditIntelligenceOutput {
  return {
    summary:
      "The store has solid catalog foundations but homepage social proof and product-page completeness need attention.",
    priority: 2,
    confidence: 0.88,
    storeHealthScore: facts.storeHealthScore,
    homepageScore: facts.homepageScore,
    performanceScore: facts.performanceScore,
    seoScore: facts.seoScore,
    accessibilityScore: facts.accessibilityScore,
    conversionScore: facts.conversionScore,
    mobileScore: facts.mobileScore,
    themeScore: facts.themeScore,
    findings: [
      {
        id: "homepage-social-proof-gap",
        section: "Homepage",
        title: "Homepage lacks visible social proof",
        detail: "Recent order volume supports adding reviews or order-count trust signals above the fold.",
        severity: "medium",
        confidence: 0.86,
      },
      {
        id: "product-sku-gap",
        section: "Product Pages",
        title: "Some products are missing SKU coverage",
        detail: "Missing SKUs weaken internal linking, SEO canonical signals, and operational clarity.",
        severity: "high",
        confidence: 0.9,
      },
    ],
    recommendations: [
      {
        id: "audit:homepage-social-proof",
        category: "Homepage",
        title: "Add homepage social proof above the fold",
        reason:
          "The homepage score shows strong hero and CTA readiness, but social proof is still missing despite healthy recent order volume.",
        evidenceKeys: ["homepage_score", "homepage_primary_cta", "conversion_social_proof"],
        merchantAction: [
          "Add a homepage review carousel or recent-order trust badge near the primary CTA",
          "Highlight top-selling products with order-count proof",
        ],
        expectedResult: "Increase homepage trust and lift click-through on the primary CTA",
        estimatedImpact: "Improve conversion readiness on the homepage within two weeks",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.9,
        verificationCriteria: "Homepage score improves after social proof is published",
        timeline: "1-2 weeks",
      },
      {
        id: "audit:product-sku-cleanup",
        category: "Product Pages",
        title: "Complete SKU coverage on active products",
        reason:
          "Missing SKUs create product-page gaps that hurt SEO structure and merchant operations.",
        evidenceKeys: ["product_missing_sku", "seo_score", "seo_title_coverage"],
        merchantAction: [
          "Add SKUs to all active products missing identifiers",
          "Review product titles shorter than 20 characters and expand them for clarity",
        ],
        expectedResult: "Improve product-page completeness and SEO readiness",
        estimatedImpact: "Reduce catalog quality gaps and support stronger SEO coverage",
        difficulty: "Medium",
        priority: 2,
        confidence: 0.87,
        verificationCriteria: "Product missing SKU count returns to zero",
        timeline: "2 weeks",
      },
    ],
    opportunities: ["Homepage trust uplift from existing order momentum"],
    risks: ["Conversion friction if product-page completeness gaps remain"],
  };
}
