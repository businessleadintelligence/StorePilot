import { describe, expect, it } from "vitest";

import { analyzeSeoContent } from "../../tools/seo-content-tool";
import { analyzeSeoAccessibility } from "../../tools/seo-accessibility-tool";
import { calculateSeoIntelligenceHealthScore } from "../../tools/seo-health-tool";
import { estimateSeoImpact } from "../../tools/seo-impact-tool";
import { assignSeoRecommendationGroup } from "../../tools/seo-group-tool";
import { calculateSeoPriorityScore } from "../../tools/seo-ranking-tool";
import { dedupeSimilarSeoRecommendations } from "../../tools/seo-similarity-tool";
import { analyzeTechnicalSeo } from "../../tools/seo-technical-tool";
import { createSeoIntelligenceFactsBuilder } from "../../facts/seo-intelligence-facts";
import { buildSeoIntelligenceEvidenceCatalog } from "../../agents/seo-intelligence-evidence";
import { buildSeoIntelligenceFactsFromSnapshot, createMockSeoIntelligenceSnapshot } from "./helpers";

describe("SEO intelligence deterministic tools", () => {
  it("flags content gaps from short titles and thin pages", () => {
    const result = analyzeSeoContent({
      totalProducts: 12,
      productsWithShortTitles: 3,
      thinContentPages: 4,
      missingCollectionDescriptions: 1,
      collectionCount: 4,
    });

    expect(result.issues).toContain("content_short_titles");
    expect(result.score).toBeLessThan(90);
  });

  it("flags technical SEO gaps from duplicate titles", () => {
    const result = analyzeTechnicalSeo({
      duplicateTitles: 2,
      canonicalIssues: 1,
      structuredDataLikely: false,
      headingOrderIssues: 1,
    });

    expect(result.issues).toContain("technical_duplicate_titles");
    expect(result.score).toBeLessThan(70);
  });

  it("estimates SEO impact by category", () => {
    const impact = estimateSeoImpact({
      category: "Metadata",
      confidence: 0.8,
      sectionScore: 55,
    });

    expect(impact.trafficGain).toBeGreaterThan(0);
  });

  it("assigns recommendation groups", () => {
    expect(
      assignSeoRecommendationGroup({
        category: "Core Web Vitals",
        priorityScore: 65,
        hasDeterministicImpact: true,
      }),
    ).toBe("Technical Improvements");
  });

  it("dedupes similar recommendations", () => {
    const deduped = dedupeSimilarSeoRecommendations([
      { category: "Metadata", title: "Expand product titles", confidence: 0.7, priorityScore: 60 },
      { category: "Metadata", title: "Expand product titles", confidence: 0.9, priorityScore: 80 },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.confidence).toBe(0.9);
  });

  it("builds facts from snapshot source", async () => {
    const snapshot = createMockSeoIntelligenceSnapshot();
    const builder = createSeoIntelligenceFactsBuilder({
      async getSeoIntelligenceSnapshot() {
        return snapshot;
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "seo_audit" });

    expect(facts.seoHealthScore).toBeGreaterThan(0);
    expect(facts.scores.seoScore).toBeGreaterThan(0);
    expect(facts.content.score).toBeGreaterThan(0);
    expect(facts.technical.score).toBeGreaterThan(0);
    expect(facts.ruleSetVersion).toBeTruthy();
  });

  it("builds evidence catalog from facts", async () => {
    const catalog = buildSeoIntelligenceEvidenceCatalog(await buildSeoIntelligenceFactsFromSnapshot());

    expect(catalog.some((entry) => entry.key === "seo_health_score")).toBe(true);
    expect(catalog.some((entry) => entry.key === "content_score")).toBe(true);
  });

  it("calculates composite health score", () => {
    const score = calculateSeoIntelligenceHealthScore({
      scores: {
        seoScore: 76,
        technicalSeoScore: 74,
        contentScore: 68,
        indexabilityScore: 72,
        internalLinkingScore: 70,
        structuredDataScore: 75,
        coreWebVitalsScore: 80,
        performanceScore: 76,
        searchVisibilityScore: 65,
        organicOpportunityScore: 70,
        imageOptimizationScore: 72,
        accessibilityScore: 71,
        duplicateContentScore: 88,
        canonicalHealth: 74,
        headingStructureScore: 76,
      },
      criticalIssueCount: 3,
    });

    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("audits accessibility proxies", () => {
    expect(
      analyzeSeoAccessibility({
        missingAltTextProxy: 3,
        headingOrderIssues: 1,
        totalProducts: 12,
      }).score,
    ).toBeLessThan(90);
  });

  it("ranks SEO recommendations by priority score", () => {
    const score = calculateSeoPriorityScore({
      confidence: 0.9,
      difficultyWeight: 1,
      impact: { trafficGain: 4, revenueGain: null, visibilityLift: 0.1, ctrLift: null, indexabilityImprovement: null },
      sectionScore: 55,
    });

    expect(score).toBeGreaterThan(50);
  });
});
