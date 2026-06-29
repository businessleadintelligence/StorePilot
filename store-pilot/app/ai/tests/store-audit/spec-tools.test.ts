import { describe, expect, it } from "vitest";
import { analyzeStoreSpeed } from "../../tools/store-speed-tool";
import { analyzeThemePerformance } from "../../tools/theme-analysis-tool";
import { analyzeNavigation } from "../../tools/navigation-analysis-tool";
import { analyzeCollections } from "../../tools/collection-analysis-tool";
import { analyzeSeo } from "../../tools/seo-analysis-tool";
import { analyzeTechnicalSeo } from "../../tools/technical-seo-tool";
import { analyzeImages } from "../../tools/image-analysis-tool";
import { analyzeTrustSignals } from "../../tools/trust-analysis-tool";
import { analyzePolicies, analyzeMerchantBestPractices } from "../../tools/policy-analysis-tool";
import { analyzeMobileExperience } from "../../tools/mobile-analysis-tool";
import { analyzeAccessibility } from "../../tools/accessibility-tool";
import { analyzeConversionOptimization } from "../../tools/conversion-analysis-tool";
import { analyzeAppBloat } from "../../tools/app-bloat-tool";
import {
  calculateAuditHealthScore,
  classifyAuditHealthBand,
} from "../../tools/audit-health-score-tool";
import { rankAuditRecommendations } from "../../tools/audit-ranking-tool";
import { areAuditRecommendationsSimilar } from "../../tools/audit-similarity-tool";
import { assignStoreAuditRecommendationGroup } from "../../tools/audit-group-tool";
import { estimateAuditImpact } from "../../tools/audit-impact-tool";

describe("Store audit spec-named tools", () => {
  it("scores slow stores lower in store speed tool", () => {
    const slow = analyzeStoreSpeed({
      activeProductCount: 250,
      webhookCount: 12,
      syncLatencyDays: 10,
      largeCatalog: true,
    });
    const fast = analyzeStoreSpeed({
      activeProductCount: 20,
      webhookCount: 3,
      syncLatencyDays: 1,
      largeCatalog: false,
    });
    expect(slow.score).toBeLessThan(fast.score);
    expect(slow.issues.length).toBeGreaterThan(0);
  });

  it("analyzes theme performance through theme analysis tool", () => {
    const result = analyzeThemePerformance({
      activeProductCount: 250,
      webhookCount: 12,
      largeCatalog: true,
      syncLatencyDays: 10,
    });
    expect(result.jsBundleRisk).toBe(true);
    expect(result.score).toBeLessThan(70);
  });

  it("analyzes navigation depth and search", () => {
    const result = analyzeNavigation({
      collectionCount: 8,
      activeProductCount: 40,
      duplicateCollectionTitles: 1,
      productsMissingSku: 2,
    });
    expect(result.menuDepth).toBeGreaterThan(0);
    expect(result.searchAvailable).toBe(true);
  });

  it("flags empty collections", () => {
    const result = analyzeCollections({
      collectionCount: 4,
      emptyCollections: 2,
      missingDescriptions: 1,
      duplicateCollections: 0,
      missingImages: 1,
    });
    expect(result.score).toBeLessThan(80);
    expect(result.issues).toContain("collection_empty");
  });

  it("analyzes SEO coverage", () => {
    const result = analyzeSeo({
      productsWithShortTitles: 3,
      productsWithLongTitles: 7,
      totalProducts: 10,
      duplicateTitles: 1,
      missingSku: 1,
    });
    expect(result.titleCoverage).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("analyzes technical SEO risks", () => {
    const result = analyzeTechnicalSeo({
      duplicateTitles: 2,
      missingSku: 3,
      totalProducts: 10,
      structuredDataLikely: false,
      webhookCount: 4,
    });
    expect(result.canonicalRisk).toBe(true);
    expect(result.score).toBeLessThan(70);
  });

  it("analyzes image optimization and alt text", () => {
    const weak = analyzeImages({
      missingAltTextProxy: 5,
      totalProducts: 10,
      imageOptimizationScore: 50,
      largeCatalog: true,
    });
    const strong = analyzeImages({
      missingAltTextProxy: 0,
      totalProducts: 10,
      imageOptimizationScore: 85,
      largeCatalog: false,
    });
    expect(weak.score).toBeLessThan(strong.score);
  });

  it("analyzes trust signals from social proof and policies", () => {
    const weak = analyzeTrustSignals({
      recentOrderCount: 0,
      hasCompletedOnboarding: false,
      socialProofScore: 40,
      policyScore: 40,
      hasPrimaryCta: false,
    });
    expect(weak.score).toBeLessThan(60);
    expect(weak.issues.length).toBeGreaterThan(0);
  });

  it("analyzes policy completeness", () => {
    const result = analyzePolicies({
      hasCompletedOnboarding: true,
      activeProductCount: 10,
      recentOrderCount: 5,
    });
    expect(result.refundPolicyLikely).toBe(true);
    expect(result.score).toBeGreaterThan(70);
  });

  it("analyzes merchant best practices", () => {
    const weak = analyzeMerchantBestPractices({
      hasCompletedOnboarding: false,
      missingSku: 4,
      shortTitles: 3,
      activeProductCount: 5,
      draftProductCount: 10,
    });
    expect(weak.catalogComplete).toBe(false);
    expect(weak.issues.length).toBeGreaterThan(0);
  });

  it("analyzes mobile experience", () => {
    const result = analyzeMobileExperience({
      averageTitleLength: 18,
      activeProductCount: 12,
      hasPrimaryCta: true,
      menuDepth: 3,
    });
    expect(result.touchTargetScore).toBeGreaterThan(0);
  });

  it("analyzes accessibility alt coverage", () => {
    const result = analyzeAccessibility({
      productsWithoutDescriptiveTitles: 2,
      shortButtonLabels: 1,
      headingOrderIssues: 1,
      missingAltTextProxy: 3,
      totalProducts: 10,
    });
    expect(result.altTextCoverage).toBeLessThan(100);
  });

  it("analyzes conversion optimization", () => {
    const result = analyzeConversionOptimization({
      recentOrderCount: 2,
      averageOrderValue: 45,
      activeProductCount: 8,
      draftProducts: 1,
      bundleVisibilityScore: 40,
    });
    expect(result.cartFrictionScore).toBeGreaterThan(0);
  });

  it("analyzes app bloat from integrations", () => {
    const bloated = analyzeAppBloat({
      webhookCount: 15,
      duplicateWebhookTopics: 2,
      staleWebhookCount: 4,
    });
    expect(bloated.score).toBeLessThan(70);
    expect(bloated.unusedApps).toBeGreaterThan(0);
  });

  it("calculates audit health score with penalties", () => {
    const score = calculateAuditHealthScore({
      homepageScore: 80,
      performanceScore: 80,
      seoScore: 80,
      accessibilityScore: 80,
      conversionScore: 80,
      mobileScore: 80,
      themeScore: 80,
      criticalIssueCount: 5,
    });
    expect(score).toBeLessThan(80);
    expect(classifyAuditHealthBand(score)).toBe("watch");
  });

  it("ranks audit recommendations by priority score", () => {
    const ranked = rankAuditRecommendations([
      { id: "a", priorityScore: 40, confidence: 0.8, category: "SEO" },
      { id: "b", priorityScore: 90, confidence: 0.9, category: "Homepage" },
    ]);
    expect(ranked[0]?.id).toBe("b");
  });

  it("detects similar audit recommendations", () => {
    expect(
      areAuditRecommendationsSimilar(
        { category: "Images", title: "Compress product images" },
        { category: "Images", title: "Compress product images" },
      ),
    ).toBe(true);
  });

  it("assigns SEO recommendations to SEO improvements group", () => {
    expect(
      assignStoreAuditRecommendationGroup({
        category: "SEO",
        priorityScore: 70,
        hasDeterministicImpact: true,
      }),
    ).toBe("SEO Improvements");
  });

  it("estimates accessibility impact", () => {
    const impact = estimateAuditImpact({
      category: "Accessibility",
      confidence: 0.9,
      sectionScore: 55,
    });
    expect(impact.accessibilityImprovement).toBeGreaterThan(0);
  });
});

describe("Store audit tool score boundaries", () => {
  const tools = [
    () => analyzeStoreSpeed({ activeProductCount: 0, webhookCount: 0, syncLatencyDays: null, largeCatalog: false }),
    () => analyzeThemePerformance({ activeProductCount: 0, webhookCount: 0, largeCatalog: false, syncLatencyDays: null }),
    () => analyzeNavigation({ collectionCount: 0, activeProductCount: 0, duplicateCollectionTitles: 0, productsMissingSku: 0 }),
    () => analyzeCollections({ collectionCount: 0, emptyCollections: 0, missingDescriptions: 0, duplicateCollections: 0, missingImages: 0 }),
    () => analyzeSeo({ productsWithShortTitles: 0, productsWithLongTitles: 0, totalProducts: 0, duplicateTitles: 0, missingSku: 0 }),
    () => analyzeTechnicalSeo({ duplicateTitles: 0, missingSku: 0, totalProducts: 0, structuredDataLikely: false, webhookCount: 0 }),
    () => analyzeImages({ missingAltTextProxy: 0, totalProducts: 0, imageOptimizationScore: 70, largeCatalog: false }),
    () => analyzePolicies({ hasCompletedOnboarding: false, activeProductCount: 0, recentOrderCount: 0 }),
    () => analyzeMerchantBestPractices({ hasCompletedOnboarding: false, missingSku: 0, shortTitles: 0, activeProductCount: 0, draftProductCount: 0 }),
  ];

  for (const [index, run] of tools.entries()) {
    it(`keeps tool ${index + 1} score within 0-100`, () => {
      const result = run() as { score: number };
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  }
});
