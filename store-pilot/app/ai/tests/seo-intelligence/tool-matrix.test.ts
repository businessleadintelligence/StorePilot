import { describe, expect, it } from "vitest";

import { analyzeSeoContent } from "../../tools/seo-content-tool";
import { analyzeTechnicalSeo } from "../../tools/seo-technical-tool";
import { calculateSeoIntelligenceHealthScore } from "../../tools/seo-health-tool";
import { estimateSeoImpact } from "../../tools/seo-impact-tool";
import { assignSeoRecommendationGroup } from "../../tools/seo-group-tool";
import { areSeoRecommendationsSimilar } from "../../tools/seo-similarity-tool";
import { buildSeoIntelligenceEvidenceCatalog } from "../../agents/seo-intelligence-evidence";
import { buildSeoIntelligenceFactsFromSnapshot } from "./helpers";
import { SEO_INTELLIGENCE_GROUPS, SEO_INTELLIGENCE_CATEGORIES } from "../../schemas/seo-intelligence";

describe("SEO intelligence tool matrix", () => {
  for (const category of SEO_INTELLIGENCE_CATEGORIES) {
    it(`supports category ${category}`, () => {
      expect(category.length).toBeGreaterThan(2);
    });
  }

  for (const group of SEO_INTELLIGENCE_GROUPS) {
    it(`supports group ${group}`, () => {
      expect(group.length).toBeGreaterThan(2);
    });
  }

  it("scores content with short titles lower", () => {
    const weak = analyzeSeoContent({
      totalProducts: 10,
      productsWithShortTitles: 5,
      thinContentPages: 5,
      missingCollectionDescriptions: 2,
      collectionCount: 4,
    });
    const strong = analyzeSeoContent({
      totalProducts: 10,
      productsWithShortTitles: 0,
      thinContentPages: 0,
      missingCollectionDescriptions: 0,
      collectionCount: 4,
    });

    expect(weak.score).toBeLessThan(strong.score);
  });

  it("scores technical SEO with duplicate titles lower", () => {
    const withDuplicates = analyzeTechnicalSeo({
      duplicateTitles: 3,
      canonicalIssues: 1,
      structuredDataLikely: true,
      headingOrderIssues: 0,
    });
    const withoutDuplicates = analyzeTechnicalSeo({
      duplicateTitles: 0,
      canonicalIssues: 0,
      structuredDataLikely: true,
      headingOrderIssues: 0,
    });

    expect(withDuplicates.score).toBeLessThan(withoutDuplicates.score);
  });

  it("calculates health score penalties for critical issues", () => {
    const lowIssues = calculateSeoIntelligenceHealthScore({
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
      criticalIssueCount: 0,
    });
    const highIssues = calculateSeoIntelligenceHealthScore({
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
      criticalIssueCount: 8,
    });

    expect(highIssues).toBeLessThan(lowIssues);
  });

  it("assigns technical groups for core web vitals categories", () => {
    expect(
      assignSeoRecommendationGroup({
        category: "Core Web Vitals",
        priorityScore: 80,
        hasDeterministicImpact: true,
      }),
    ).toBe("Critical Fixes");
  });

  it("detects similar recommendations", () => {
    expect(
      areSeoRecommendationsSimilar(
        { category: "Metadata", title: "Improve titles" },
        { category: "Metadata", title: "Improve titles" },
      ),
    ).toBe(true);
    expect(
      areSeoRecommendationsSimilar(
        { category: "Metadata", title: "Improve titles" },
        { category: "Images", title: "Improve titles" },
      ),
    ).toBe(false);
  });

  it("estimates metadata impact for metadata category", () => {
    const impact = estimateSeoImpact({
      category: "Metadata",
      confidence: 0.85,
      sectionScore: 50,
    });

    expect(impact.trafficGain).toBeGreaterThan(0);
  });

  it("builds evidence catalog with section coverage", async () => {
    const catalog = buildSeoIntelligenceEvidenceCatalog(await buildSeoIntelligenceFactsFromSnapshot());
    const keys = catalog.map((entry) => entry.key);

    expect(keys).toContain("seo_health_score");
    expect(keys).toContain("seo_score");
    expect(keys).toContain("technical_seo_score");
    expect(keys).toContain("content_score");
    expect(keys).toContain("search_visibility_score");
    expect(keys).toContain("core_web_vitals_score");
    expect(keys).toContain("critical_issue_count");
  });
});
