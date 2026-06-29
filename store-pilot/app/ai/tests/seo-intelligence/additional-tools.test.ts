import { describe, expect, it } from "vitest";

import { analyzeSeoIndexability } from "../../tools/seo-indexability-tool";
import { analyzeSeoInternalLinking } from "../../tools/seo-internal-linking-tool";
import { analyzeSeoStructuredData } from "../../tools/seo-structured-data-tool";
import { analyzeSeoCoreWebVitals } from "../../tools/seo-core-web-vitals-tool";
import { analyzeSeoPerformance } from "../../tools/seo-performance-tool";
import { analyzeSeoDuplicateContent } from "../../tools/seo-duplicate-content-tool";
import { analyzeSeoCanonicalHealth } from "../../tools/seo-canonical-tool";
import { analyzeSeoHeadingStructure } from "../../tools/seo-heading-structure-tool";
import { analyzeSeoSearchVisibility } from "../../tools/seo-search-visibility-tool";
import { analyzeSeoOrganicOpportunity } from "../../tools/seo-organic-opportunity-tool";
import { classifySeoHealthBand } from "../../tools/seo-health-tool";
import { deriveSeoOverallPriority, deriveSeoOverallConfidence } from "../../tools/seo-ranking-tool";
import { buildSeoIntelligenceSubjectKey } from "../../../services/seo-intelligence.server";
import { validateSeoIntelligenceEvidenceKeys } from "../../agents/seo-intelligence-evidence";

describe("SEO intelligence additional tools", () => {
  it("audits indexability coverage gaps", () => {
    const result = analyzeSeoIndexability({
      indexedPagesProxy: 8,
      totalPagesProxy: 20,
      canonicalIssues: 2,
    });

    expect(result.score).toBeLessThan(70);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits internal linking structure gaps", () => {
    const result = analyzeSeoInternalLinking({
      collectionCount: 1,
      activeProductCount: 40,
      navigationDepthProxy: 5,
    });

    expect(result.score).toBeLessThan(75);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits structured data readiness", () => {
    const result = analyzeSeoStructuredData({
      structuredDataLikely: false,
      totalProducts: 12,
    });

    expect(result.score).toBeLessThan(80);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits core web vitals thresholds", () => {
    const result = analyzeSeoCoreWebVitals({
      lcpScore: 35,
      clsScore: 40,
      inpScore: 38,
    });

    expect(result.score).toBeLessThan(60);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits performance sync risks", () => {
    const result = analyzeSeoPerformance({
      syncLatencyDays: 12,
      webhookCount: 14,
    });

    expect(result.score).toBeLessThan(75);
  });

  it("audits duplicate content risks", () => {
    const result = analyzeSeoDuplicateContent({
      duplicateTitles: 4,
      thinContentPages: 5,
    });

    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits canonical health", () => {
    const result = analyzeSeoCanonicalHealth({
      duplicateTitles: 3,
      missingSku: 2,
    });

    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits heading structure issues", () => {
    const result = analyzeSeoHeadingStructure({
      headingOrderIssues: 4,
    });

    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits search visibility proxies", () => {
    const result = analyzeSeoSearchVisibility({
      averagePositionProxy: 30,
      averageCtrProxy: 0.01,
      impressionsProxy: 80,
    });

    expect(result.score).toBeLessThan(70);
  });

  it("audits organic opportunity mix", () => {
    const result = analyzeSeoOrganicOpportunity({
      contentScore: 50,
      technicalSeoScore: 55,
      searchVisibilityScore: 45,
      coreWebVitalsScore: 60,
    });

    expect(result.score).toBeGreaterThan(0);
  });

  it("classifies health bands and overall priority", () => {
    expect(classifySeoHealthBand(85)).toBe("strong");
    expect(classifySeoHealthBand(65)).toBe("watch");
    expect(classifySeoHealthBand(40)).toBe("weak");
    expect(deriveSeoOverallPriority([90, 70])).toBe(1);
    expect(deriveSeoOverallConfidence([0.8, 0.6])).toBe(0.7);
  });

  it("builds SEO intelligence subject key and evidence keys", async () => {
    expect(buildSeoIntelligenceSubjectKey("store-123")).toBe("seo-intelligence:store-123");

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
});
