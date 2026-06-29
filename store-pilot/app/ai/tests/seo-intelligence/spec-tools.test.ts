import { describe, expect, it } from "vitest";

import { buildMockSeoScores } from "./helpers";
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
import {
  calculateSeoIntelligenceHealthScore,
  classifySeoHealthBand,
} from "../../tools/seo-health-tool";
import { rankSeoRecommendations } from "../../tools/seo-ranking-tool";
import { areSeoRecommendationsSimilar } from "../../tools/seo-similarity-tool";
import { assignSeoRecommendationGroup } from "../../tools/seo-group-tool";
import { estimateSeoImpact } from "../../tools/seo-impact-tool";
import { calculateSeoIntelligenceScores } from "../../tools/seo-intelligence-scores-tool";

describe("SEO intelligence spec-named tools", () => {
  it("scores thin content lower in content tool", () => {
    const weak = analyzeSeoContent({
      totalProducts: 12,
      productsWithShortTitles: 6,
      thinContentPages: 8,
      missingCollectionDescriptions: 2,
      collectionCount: 4,
    });
    const strong = analyzeSeoContent({
      totalProducts: 12,
      productsWithShortTitles: 0,
      thinContentPages: 0,
      missingCollectionDescriptions: 0,
      collectionCount: 4,
    });
    expect(weak.score).toBeLessThan(strong.score);
    expect(weak.issues.length).toBeGreaterThan(0);
  });

  it("analyzes technical SEO through technical tool", () => {
    const result = analyzeTechnicalSeo({
      duplicateTitles: 3,
      canonicalIssues: 2,
      structuredDataLikely: false,
      headingOrderIssues: 1,
    });
    expect(result.issues).toContain("technical_duplicate_titles");
    expect(result.score).toBeLessThan(70);
  });

  it("analyzes indexability coverage", () => {
    const result = analyzeSeoIndexability({
      indexedPagesProxy: 10,
      totalPagesProxy: 20,
      canonicalIssues: 2,
    });
    expect(result.score).toBeLessThan(80);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("analyzes internal linking depth", () => {
    const result = analyzeSeoInternalLinking({
      collectionCount: 2,
      activeProductCount: 30,
      navigationDepthProxy: 4,
    });
    expect(result.score).toBeLessThan(80);
  });

  it("flags missing structured data", () => {
    const result = analyzeSeoStructuredData({
      structuredDataLikely: false,
      totalProducts: 10,
    });
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("analyzes core web vitals", () => {
    const weak = analyzeSeoCoreWebVitals({ lcpScore: 40, clsScore: 45, inpScore: 42 });
    const strong = analyzeSeoCoreWebVitals({ lcpScore: 90, clsScore: 92, inpScore: 88 });
    expect(weak.score).toBeLessThan(strong.score);
  });

  it("analyzes performance sync latency", () => {
    const slow = analyzeSeoPerformance({ syncLatencyDays: 10, webhookCount: 12 });
    const fast = analyzeSeoPerformance({ syncLatencyDays: 1, webhookCount: 3 });
    expect(slow.score).toBeLessThan(fast.score);
  });

  it("analyzes image optimization and alt text", () => {
    const weak = analyzeSeoImageOptimization({ missingAltTextProxy: 5, totalProducts: 10 });
    const strong = analyzeSeoImageOptimization({ missingAltTextProxy: 0, totalProducts: 10 });
    expect(weak.score).toBeLessThan(strong.score);
  });

  it("analyzes accessibility alt coverage", () => {
    const result = analyzeSeoAccessibility({
      missingAltTextProxy: 5,
      headingOrderIssues: 1,
      totalProducts: 10,
    });
    expect(result.score).toBeLessThan(90);
  });

  it("analyzes duplicate content risks", () => {
    const result = analyzeSeoDuplicateContent({ duplicateTitles: 3, thinContentPages: 4 });
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("analyzes canonical health", () => {
    const result = analyzeSeoCanonicalHealth({ duplicateTitles: 2, missingSku: 2 });
    expect(result.score).toBeLessThan(80);
  });

  it("analyzes heading structure", () => {
    const result = analyzeSeoHeadingStructure({ headingOrderIssues: 3 });
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("analyzes search visibility proxies", () => {
    const result = analyzeSeoSearchVisibility({
      averagePositionProxy: 28,
      averageCtrProxy: 0.015,
      impressionsProxy: 120,
    });
    expect(result.score).toBeLessThan(80);
  });

  it("analyzes organic opportunity", () => {
    const result = analyzeSeoOrganicOpportunity({
      contentScore: 55,
      technicalSeoScore: 60,
      searchVisibilityScore: 50,
      coreWebVitalsScore: 70,
    });
    expect(result.score).toBeGreaterThan(0);
  });

  it("calculates SEO health score with penalties", () => {
    const score = calculateSeoIntelligenceHealthScore({
      scores: buildMockSeoScores({
        seoScore: 80,
        technicalSeoScore: 80,
        contentScore: 80,
        indexabilityScore: 80,
        internalLinkingScore: 80,
        structuredDataScore: 80,
        coreWebVitalsScore: 80,
        searchVisibilityScore: 80,
        organicOpportunityScore: 80,
        imageOptimizationScore: 80,
        accessibilityScore: 80,
        canonicalHealth: 80,
        headingStructureScore: 80,
      }),
      criticalIssueCount: 5,
    });
    expect(score).toBeLessThan(80);
    expect(classifySeoHealthBand(score)).toBe("watch");
  });

  it("ranks SEO recommendations by priority score", () => {
    const ranked = rankSeoRecommendations([
      { id: "a", priorityScore: 40, confidence: 0.8 },
      { id: "b", priorityScore: 90, confidence: 0.9 },
    ]);
    expect(ranked[0]?.id).toBe("b");
  });

  it("detects similar SEO recommendations", () => {
    expect(
      areSeoRecommendationsSimilar(
        { category: "Images", title: "Add alt text to product images" },
        { category: "Images", title: "Add alt text to product images" },
      ),
    ).toBe(true);
  });

  it("assigns metadata recommendations to organic growth group", () => {
    expect(
      assignSeoRecommendationGroup({
        category: "Metadata",
        priorityScore: 50,
        hasDeterministicImpact: false,
      }),
    ).toBe("Organic Growth");
  });

  it("estimates accessibility impact", () => {
    const impact = estimateSeoImpact({
      category: "Accessibility",
      confidence: 0.9,
      sectionScore: 55,
    });
    expect(impact.indexabilityImprovement ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe("SEO intelligence tool score boundaries", () => {
  const tools = [
    () => analyzeSeoContent({ totalProducts: 0, productsWithShortTitles: 0, thinContentPages: 0, missingCollectionDescriptions: 0, collectionCount: 0 }),
    () => analyzeTechnicalSeo({ duplicateTitles: 0, canonicalIssues: 0, structuredDataLikely: true, headingOrderIssues: 0 }),
    () => analyzeSeoIndexability({ indexedPagesProxy: 0, totalPagesProxy: 0, canonicalIssues: 0 }),
    () => analyzeSeoInternalLinking({ collectionCount: 0, activeProductCount: 0, navigationDepthProxy: 1 }),
    () => analyzeSeoStructuredData({ structuredDataLikely: true, totalProducts: 0 }),
    () => analyzeSeoCoreWebVitals({ lcpScore: 0, clsScore: 0, inpScore: 0 }),
    () => analyzeSeoImageOptimization({ missingAltTextProxy: 0, totalProducts: 0 }),
    () => analyzeSeoSearchVisibility({ averagePositionProxy: 0, averageCtrProxy: 0, impressionsProxy: 0 }),
    () => {
      const scores = calculateSeoIntelligenceScores({
        totalProducts: 0,
        productsWithMetaTitle: 0,
        productsWithMetaDescription: 0,
        productsWithShortTitles: 0,
        duplicateTitles: 0,
        missingAltTextProxy: 0,
        thinContentPages: 0,
        collectionCount: 0,
        missingCollectionDescriptions: 0,
        internalLinkScoreProxy: 50,
        structuredDataLikely: false,
        canonicalIssues: 0,
        indexedPagesProxy: 0,
        totalPagesProxy: 0,
        headingOrderIssues: 0,
        lcpScore: 0,
        clsScore: 0,
        inpScore: 0,
        performanceScore: 70,
        accessibilityScore: 70,
        searchVisibilityProxy: 70,
        averageCtrProxy: 0,
        averagePositionProxy: 0,
      });
      return { score: scores.seoScore };
    },
  ];

  for (const [index, run] of tools.entries()) {
    it(`keeps tool ${index + 1} score within 0-100`, () => {
      const result = run() as { score: number };
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  }
});
