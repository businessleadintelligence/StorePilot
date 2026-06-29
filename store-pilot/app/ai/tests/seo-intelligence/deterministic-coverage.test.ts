import { describe, expect, it } from "vitest";

import { analyzeSeoContent } from "../../tools/seo-content-tool";
import { analyzeTechnicalSeo } from "../../tools/seo-technical-tool";
import { analyzeSeoIndexability } from "../../tools/seo-indexability-tool";
import { analyzeSeoInternalLinking } from "../../tools/seo-internal-linking-tool";
import { analyzeSeoStructuredData } from "../../tools/seo-structured-data-tool";
import { analyzeSeoCoreWebVitals } from "../../tools/seo-core-web-vitals-tool";
import { analyzeSeoPerformance } from "../../tools/seo-performance-tool";
import { analyzeSeoImageOptimization } from "../../tools/seo-image-optimization-tool";
import { analyzeSeoAccessibility } from "../../tools/seo-accessibility-tool";
import { calculateSeoIntelligenceHealthScore } from "../../tools/seo-health-tool";
import { calculateSeoPriorityScore } from "../../tools/seo-ranking-tool";
import { estimateSeoImpact } from "../../tools/seo-impact-tool";
import { buildSeoRecommendationGroups } from "../../tools/seo-group-tool";
import { dedupeSimilarSeoRecommendations } from "../../tools/seo-similarity-tool";
import { validateSeoIntelligenceEvidenceKeys } from "../../agents/seo-intelligence-evidence";

describe("SEO intelligence deterministic coverage", () => {
  const toolCases = [
    {
      name: "content empty catalog",
      run: () =>
        analyzeSeoContent({
          totalProducts: 0,
          productsWithShortTitles: 0,
          thinContentPages: 0,
          missingCollectionDescriptions: 0,
          collectionCount: 0,
        }),
      assert: (result: ReturnType<typeof analyzeSeoContent>) => expect(result.score).toBeGreaterThanOrEqual(0),
    },
    {
      name: "technical healthy",
      run: () =>
        analyzeTechnicalSeo({
          duplicateTitles: 0,
          canonicalIssues: 0,
          structuredDataLikely: true,
          headingOrderIssues: 0,
        }),
      assert: (result: ReturnType<typeof analyzeTechnicalSeo>) => expect(result.issues).toHaveLength(0),
    },
    {
      name: "indexability healthy",
      run: () =>
        analyzeSeoIndexability({
          indexedPagesProxy: 20,
          totalPagesProxy: 20,
          canonicalIssues: 0,
        }),
      assert: (result: ReturnType<typeof analyzeSeoIndexability>) => expect(result.score).toBeGreaterThan(65),
    },
    {
      name: "internal linking healthy",
      run: () =>
        analyzeSeoInternalLinking({
          collectionCount: 6,
          activeProductCount: 20,
          navigationDepthProxy: 2,
        }),
      assert: (result: ReturnType<typeof analyzeSeoInternalLinking>) => expect(result.score).toBeGreaterThan(65),
    },
    {
      name: "structured data healthy",
      run: () =>
        analyzeSeoStructuredData({
          structuredDataLikely: true,
          totalProducts: 20,
        }),
      assert: (result: ReturnType<typeof analyzeSeoStructuredData>) => expect(result.score).toBeGreaterThan(70),
    },
    {
      name: "core web vitals healthy",
      run: () =>
        analyzeSeoCoreWebVitals({
          lcpScore: 90,
          clsScore: 92,
          inpScore: 88,
        }),
      assert: (result: ReturnType<typeof analyzeSeoCoreWebVitals>) => expect(result.score).toBeGreaterThan(80),
    },
    {
      name: "performance lean stack",
      run: () => analyzeSeoPerformance({ syncLatencyDays: 1, webhookCount: 3 }),
      assert: (result: ReturnType<typeof analyzeSeoPerformance>) => expect(result.score).toBeGreaterThan(70),
    },
    {
      name: "images healthy",
      run: () =>
        analyzeSeoImageOptimization({
          missingAltTextProxy: 0,
          totalProducts: 10,
        }),
      assert: (result: ReturnType<typeof analyzeSeoImageOptimization>) => expect(result.score).toBeGreaterThan(80),
    },
    {
      name: "accessibility healthy",
      run: () =>
        analyzeSeoAccessibility({
          missingAltTextProxy: 0,
          headingOrderIssues: 0,
          totalProducts: 10,
        }),
      assert: (result: ReturnType<typeof analyzeSeoAccessibility>) => expect(result.score).toBeGreaterThan(80),
    },
  ] as const;

  for (const testCase of toolCases) {
    it(`covers ${testCase.name}`, () => {
      const result = testCase.run();
      testCase.assert(result as never);
    });
  }

  it("computes bounded health score", () => {
    const score = calculateSeoIntelligenceHealthScore({
      scores: {
        seoScore: 100,
        technicalSeoScore: 100,
        contentScore: 100,
        indexabilityScore: 100,
        internalLinkingScore: 100,
        structuredDataScore: 100,
        coreWebVitalsScore: 100,
        performanceScore: 100,
        searchVisibilityScore: 100,
        organicOpportunityScore: 100,
        imageOptimizationScore: 100,
        accessibilityScore: 100,
        duplicateContentScore: 100,
        canonicalHealth: 100,
        headingStructureScore: 100,
      },
      criticalIssueCount: 0,
    });

    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(80);
  });

  it("ranks high-confidence recommendations higher", () => {
    const high = calculateSeoPriorityScore({
      confidence: 0.95,
      difficultyWeight: 1,
      impact: { trafficGain: 5, revenueGain: null, visibilityLift: 0.1, ctrLift: null, indexabilityImprovement: null },
      sectionScore: 40,
    });
    const low = calculateSeoPriorityScore({
      confidence: 0.2,
      difficultyWeight: 0.85,
      impact: { trafficGain: 0, revenueGain: null, visibilityLift: null, ctrLift: null, indexabilityImprovement: null },
      sectionScore: 85,
    });

    expect(high).toBeGreaterThan(low);
  });

  it("groups recommendations into SEO buckets", () => {
    const groups = buildSeoRecommendationGroups([
      { id: "1", group: "Technical Improvements" },
      { id: "2", group: "Long-Term SEO Strategy" },
    ]);

    expect(groups.technicalImprovements).toEqual(["1"]);
    expect(groups.longTermSeoStrategy).toEqual(["2"]);
  });

  it("dedupes SEO recommendations by category and title", () => {
    const deduped = dedupeSimilarSeoRecommendations([
      { category: "Metadata", title: "Expand product titles", confidence: 0.7 },
      { category: "Metadata", title: "Expand product titles", confidence: 0.85 },
    ]);

    expect(deduped).toHaveLength(1);
  });

  it("validates evidence keys in catalog map", () => {
    const catalog = [
      {
        key: "seo_health_score",
        label: "SEO health score",
        value: "74/100",
        factPath: "seoHealthScore",
        section: "Overview",
      },
    ];

    expect(() => validateSeoIntelligenceEvidenceKeys(["seo_health_score"], catalog)).not.toThrow();
    expect(() => validateSeoIntelligenceEvidenceKeys(["missing"], catalog)).toThrow();
  });

  it("estimates metadata impact", () => {
    const impact = estimateSeoImpact({
      category: "Metadata",
      confidence: 0.8,
      sectionScore: 55,
    });

    expect(impact.trafficGain).toBeGreaterThan(0);
  });

  it("estimates technical impact for indexability", () => {
    const impact = estimateSeoImpact({
      category: "Indexability",
      confidence: 0.75,
      sectionScore: 50,
    });

    expect(impact.indexabilityImprovement).toBeGreaterThan(0);
  });
});
