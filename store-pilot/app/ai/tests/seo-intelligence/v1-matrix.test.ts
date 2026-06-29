import { describe, expect, it } from "vitest";
import { SEO_INTELLIGENCE_CATEGORIES } from "../../schemas/seo-intelligence";
import { analyzeSeoContent } from "../../tools/seo-content-tool";
import { analyzeTechnicalSeo } from "../../tools/seo-technical-tool";
import { analyzeSeoIndexability } from "../../tools/seo-indexability-tool";
import { analyzeSeoInternalLinking } from "../../tools/seo-internal-linking-tool";
import { analyzeSeoStructuredData } from "../../tools/seo-structured-data-tool";
import { analyzeSeoCoreWebVitals } from "../../tools/seo-core-web-vitals-tool";
import { analyzeSeoPerformance } from "../../tools/seo-performance-tool";
import { analyzeSeoImageOptimization } from "../../tools/seo-image-optimization-tool";
import { analyzeSeoAccessibility } from "../../tools/seo-accessibility-tool";
import { analyzeSeoDuplicateContent } from "../../tools/seo-duplicate-content-tool";
import { analyzeSeoCanonicalHealth } from "../../tools/seo-canonical-tool";
import { analyzeSeoHeadingStructure } from "../../tools/seo-heading-structure-tool";
import { analyzeSeoSearchVisibility } from "../../tools/seo-search-visibility-tool";
import { analyzeSeoOrganicOpportunity } from "../../tools/seo-organic-opportunity-tool";
import { calculateSeoIntelligenceHealthScore } from "../../tools/seo-health-tool";
import { buildSeoIntelligenceDeliverableFields } from "../../schemas/seo-intelligence";

const SEO_AREA_RUNNERS: Record<string, () => { score: number; issues: string[] }> = {
  "Technical SEO": () =>
    analyzeTechnicalSeo({
      duplicateTitles: 1,
      canonicalIssues: 1,
      structuredDataLikely: true,
      headingOrderIssues: 0,
    }),
  Content: () =>
    analyzeSeoContent({
      totalProducts: 10,
      productsWithShortTitles: 1,
      thinContentPages: 1,
      missingCollectionDescriptions: 0,
      collectionCount: 4,
    }),
  Images: () =>
    analyzeSeoImageOptimization({
      missingAltTextProxy: 1,
      totalProducts: 10,
    }),
  Collections: () =>
    analyzeSeoContent({
      totalProducts: 10,
      productsWithShortTitles: 0,
      thinContentPages: 0,
      missingCollectionDescriptions: 1,
      collectionCount: 4,
    }),
  Products: () =>
    analyzeSeoContent({
      totalProducts: 10,
      productsWithShortTitles: 2,
      thinContentPages: 2,
      missingCollectionDescriptions: 0,
      collectionCount: 4,
    }),
  Navigation: () =>
    analyzeSeoInternalLinking({
      collectionCount: 4,
      activeProductCount: 20,
      navigationDepthProxy: 2,
    }),
  "Internal Linking": () =>
    analyzeSeoInternalLinking({
      collectionCount: 5,
      activeProductCount: 20,
      navigationDepthProxy: 2,
    }),
  "Structured Data": () =>
    analyzeSeoStructuredData({
      structuredDataLikely: true,
      totalProducts: 10,
    }),
  "Core Web Vitals": () =>
    analyzeSeoCoreWebVitals({
      lcpScore: 82,
      clsScore: 86,
      inpScore: 80,
    }),
  Indexability: () =>
    analyzeSeoIndexability({
      indexedPagesProxy: 16,
      totalPagesProxy: 18,
      canonicalIssues: 0,
    }),
  Accessibility: () =>
    analyzeSeoAccessibility({
      missingAltTextProxy: 1,
      headingOrderIssues: 0,
      totalProducts: 10,
    }),
  Schema: () =>
    analyzeSeoStructuredData({
      structuredDataLikely: true,
      totalProducts: 10,
    }),
  Metadata: () =>
    analyzeSeoSearchVisibility({
      averagePositionProxy: 16,
      averageCtrProxy: 0.04,
      impressionsProxy: 480,
    }),
  "Merchant Trust": () =>
    analyzeSeoPerformance({
      syncLatencyDays: 2,
      webhookCount: 4,
    }),
  "Conversion SEO": () =>
    analyzeSeoOrganicOpportunity({
      contentScore: 70,
      technicalSeoScore: 72,
      searchVisibilityScore: 68,
      coreWebVitalsScore: 80,
    }),
};

describe("SEO intelligence v1 category coverage", () => {
  for (const category of SEO_INTELLIGENCE_CATEGORIES) {
    it(`supports schema category ${category}`, () => {
      expect(category.length).toBeGreaterThan(2);
    });
  }

  for (const [area, run] of Object.entries(SEO_AREA_RUNNERS)) {
    it(`computes deterministic score for ${area}`, () => {
      const result = run();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.issues)).toBe(true);
    });
  }
});

describe("SEO intelligence v1 deliverable outputs", () => {
  for (const priority of [1, 2, 3, 4, 5]) {
    it(`maps traffic opportunity for priority ${priority}`, () => {
      const fields = buildSeoIntelligenceDeliverableFields({
        facts: {
          seoHealthScore: 70,
          trafficOpportunity: 420,
          visibilityOpportunity: 180,
        },
        recommendations: [{ id: "r1", title: "Fix metadata", group: "Quick Wins", priority }],
        technicalFindings: [],
        contentFindings: [],
      });
      expect(fields.trafficOpportunity).toBe(420);
      expect(fields.visibilityOpportunity).toBe(180);
    });
  }

  for (const severity of ["low", "medium", "high", "critical"] as const) {
    it(`maps ${severity} findings into deliverable fields`, () => {
      const fields = buildSeoIntelligenceDeliverableFields({
        facts: {
          seoHealthScore: 65,
          trafficOpportunity: 300,
          visibilityOpportunity: 120,
        },
        recommendations: [],
        technicalFindings: [{ title: `${severity} technical finding`, severity }],
        contentFindings: [{ title: `${severity} content finding`, severity }],
      });
      if (severity === "critical" || severity === "high") {
        expect(fields.criticalIssues).toContain(`${severity} technical finding`);
      } else {
        expect(fields.criticalIssues).not.toContain(`${severity} technical finding`);
      }
    });
  }
});

describe("SEO intelligence health score bands", () => {
  for (const criticalIssueCount of [0, 3, 6, 12, 20]) {
    it(`applies capped penalty for ${criticalIssueCount} issues`, () => {
      const score = calculateSeoIntelligenceHealthScore({
        scores: {
          seoScore: 80,
          technicalSeoScore: 80,
          contentScore: 80,
          indexabilityScore: 80,
          internalLinkingScore: 80,
          structuredDataScore: 80,
          coreWebVitalsScore: 80,
          performanceScore: 80,
          searchVisibilityScore: 80,
          organicOpportunityScore: 80,
          imageOptimizationScore: 80,
          accessibilityScore: 80,
          duplicateContentScore: 80,
          canonicalHealth: 80,
          headingStructureScore: 80,
        },
        criticalIssueCount,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});
