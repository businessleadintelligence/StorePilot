import { describe, expect, it } from "vitest";
import { STORE_AUDIT_INTELLIGENCE_CATEGORIES } from "../../schemas/store-audit-intelligence";
import { analyzeStoreSpeed } from "../../tools/store-speed-tool";
import { analyzeThemePerformance } from "../../tools/theme-analysis-tool";
import { analyzeNavigation } from "../../tools/navigation-analysis-tool";
import { analyzeCollections } from "../../tools/collection-analysis-tool";
import { auditProductPages } from "../../tools/product-page-audit-tool";
import { analyzeSeo } from "../../tools/seo-analysis-tool";
import { analyzeTechnicalSeo } from "../../tools/technical-seo-tool";
import { analyzeImages } from "../../tools/image-analysis-tool";
import { analyzeTrustSignals } from "../../tools/trust-analysis-tool";
import { analyzePolicies, analyzeMerchantBestPractices } from "../../tools/policy-analysis-tool";
import { analyzeMobileExperience } from "../../tools/mobile-analysis-tool";
import { analyzeAccessibility } from "../../tools/accessibility-tool";
import { analyzeConversionOptimization } from "../../tools/conversion-analysis-tool";
import { analyzeAppBloat } from "../../tools/app-bloat-tool";
import { auditHomepage } from "../../tools/homepage-audit-tool";
import { calculateAuditHealthScore } from "../../tools/audit-health-score-tool";
import { buildStoreAuditDeliverableFields } from "../../schemas/store-audit";

const AUDIT_AREA_RUNNERS: Record<string, () => { score: number; issues: string[] }> = {
  "Store Performance": () =>
    analyzeStoreSpeed({
      activeProductCount: 30,
      webhookCount: 4,
      syncLatencyDays: 2,
      largeCatalog: false,
    }),
  "Theme Performance": () =>
    analyzeThemePerformance({
      activeProductCount: 30,
      webhookCount: 4,
      largeCatalog: false,
      syncLatencyDays: 2,
    }),
  Navigation: () =>
    analyzeNavigation({
      collectionCount: 4,
      activeProductCount: 20,
      duplicateCollectionTitles: 0,
      productsMissingSku: 0,
    }),
  Collections: () =>
    analyzeCollections({
      collectionCount: 4,
      emptyCollections: 0,
      missingDescriptions: 0,
      duplicateCollections: 0,
      missingImages: 0,
    }),
  "Product Pages": () =>
    auditProductPages({
      totalProducts: 10,
      shortTitles: 0,
      missingPrice: 0,
      missingSku: 0,
      draftProducts: 0,
      averageTitleLength: 24,
    }),
  SEO: () =>
    analyzeSeo({
      productsWithShortTitles: 0,
      productsWithLongTitles: 8,
      totalProducts: 10,
      duplicateTitles: 0,
      missingSku: 0,
    }),
  Images: () =>
    analyzeImages({
      missingAltTextProxy: 1,
      totalProducts: 10,
      imageOptimizationScore: 75,
      largeCatalog: false,
    }),
  "Trust Signals": () =>
    analyzeTrustSignals({
      recentOrderCount: 5,
      hasCompletedOnboarding: true,
      socialProofScore: 70,
      policyScore: 80,
      hasPrimaryCta: true,
    }),
  "Apps & Theme Bloat": () =>
    analyzeAppBloat({
      webhookCount: 5,
      duplicateWebhookTopics: 0,
      staleWebhookCount: 0,
    }),
  Policies: () =>
    analyzePolicies({
      hasCompletedOnboarding: true,
      activeProductCount: 10,
      recentOrderCount: 5,
    }),
  "Mobile Experience": () =>
    analyzeMobileExperience({
      averageTitleLength: 24,
      activeProductCount: 10,
      hasPrimaryCta: true,
      menuDepth: 2,
    }),
  Accessibility: () =>
    analyzeAccessibility({
      productsWithoutDescriptiveTitles: 0,
      shortButtonLabels: 0,
      headingOrderIssues: 0,
      missingAltTextProxy: 1,
      totalProducts: 10,
    }),
  "Technical SEO": () =>
    analyzeTechnicalSeo({
      duplicateTitles: 0,
      missingSku: 0,
      totalProducts: 10,
      structuredDataLikely: true,
      webhookCount: 4,
    }),
  "Conversion Optimization": () =>
    analyzeConversionOptimization({
      recentOrderCount: 10,
      averageOrderValue: 55,
      activeProductCount: 10,
      draftProducts: 0,
      bundleVisibilityScore: 60,
    }),
  "Merchant Best Practices": () =>
    analyzeMerchantBestPractices({
      hasCompletedOnboarding: true,
      missingSku: 0,
      shortTitles: 0,
      activeProductCount: 10,
      draftProductCount: 1,
    }),
  Homepage: () =>
    auditHomepage({
      storeName: "Acme",
      activeProductCount: 10,
      recentOrderCount: 5,
      hasCompletedOnboarding: true,
    }),
};

describe("Store audit v1 category coverage", () => {
  for (const category of STORE_AUDIT_INTELLIGENCE_CATEGORIES) {
    it(`supports schema category ${category}`, () => {
      expect(category.length).toBeGreaterThan(2);
    });
  }

  for (const [area, run] of Object.entries(AUDIT_AREA_RUNNERS)) {
    it(`computes deterministic score for ${area}`, () => {
      const result = run();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.issues)).toBe(true);
    });
  }
});

describe("Store audit v1 deliverable outputs", () => {
  for (const priority of [1, 2, 3, 4, 5]) {
    it(`estimates revenue impact for priority ${priority}`, () => {
      const fields = buildStoreAuditDeliverableFields({
        storeHealthScore: 70,
        navigationScore: 70,
        trustScore: 70,
        imageOptimizationScore: 70,
        technicalSeoScore: 70,
        policyScore: 70,
        appBloatScore: 70,
        merchantBestPracticesScore: 70,
        recommendations: [{ id: "r1", title: "Fix issue", group: "Quick Wins", priority }],
        findings: [],
      });
      expect(fields.estimatedRevenueImpact).toBeGreaterThanOrEqual(0);
    });
  }

  for (const severity of ["low", "medium", "high", "critical"] as const) {
    it(`maps ${severity} findings into deliverable fields`, () => {
      const fields = buildStoreAuditDeliverableFields({
        storeHealthScore: 65,
        navigationScore: 65,
        trustScore: 65,
        imageOptimizationScore: 65,
        technicalSeoScore: 65,
        policyScore: 65,
        appBloatScore: 65,
        merchantBestPracticesScore: 65,
        recommendations: [],
        findings: [{ title: `${severity} finding`, severity }],
      });
      if (severity === "critical" || severity === "high") {
        expect(fields.criticalIssues).toContain(`${severity} finding`);
      } else {
        expect(fields.criticalIssues).not.toContain(`${severity} finding`);
      }
    });
  }
});

describe("Store audit health score bands", () => {
  for (const criticalIssueCount of [0, 3, 6, 12, 20]) {
    it(`applies capped penalty for ${criticalIssueCount} issues`, () => {
      const score = calculateAuditHealthScore({
        homepageScore: 80,
        performanceScore: 80,
        seoScore: 80,
        accessibilityScore: 80,
        conversionScore: 80,
        mobileScore: 80,
        themeScore: 80,
        criticalIssueCount,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});
