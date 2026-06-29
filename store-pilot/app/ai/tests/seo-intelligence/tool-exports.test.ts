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
import { assignSeoRecommendationGroup } from "../../tools/seo-group-tool";
import { estimateSeoImpact } from "../../tools/seo-impact-tool";
import { calculateSeoIntelligenceScores } from "../../tools/seo-intelligence-scores-tool";

describe("SEO intelligence tool exports", () => {
  const exports = [
    { name: "analyzeSeoContent", fn: analyzeSeoContent },
    { name: "analyzeTechnicalSeo", fn: analyzeTechnicalSeo },
    { name: "analyzeSeoIndexability", fn: analyzeSeoIndexability },
    { name: "analyzeSeoInternalLinking", fn: analyzeSeoInternalLinking },
    { name: "analyzeSeoStructuredData", fn: analyzeSeoStructuredData },
    { name: "analyzeSeoCoreWebVitals", fn: analyzeSeoCoreWebVitals },
    { name: "analyzeSeoPerformance", fn: analyzeSeoPerformance },
    { name: "analyzeSeoImageOptimization", fn: analyzeSeoImageOptimization },
    { name: "analyzeSeoAccessibility", fn: analyzeSeoAccessibility },
    { name: "analyzeSeoDuplicateContent", fn: analyzeSeoDuplicateContent },
    { name: "analyzeSeoCanonicalHealth", fn: analyzeSeoCanonicalHealth },
    { name: "analyzeSeoHeadingStructure", fn: analyzeSeoHeadingStructure },
    { name: "analyzeSeoSearchVisibility", fn: analyzeSeoSearchVisibility },
    { name: "analyzeSeoOrganicOpportunity", fn: analyzeSeoOrganicOpportunity },
    { name: "calculateSeoIntelligenceHealthScore", fn: calculateSeoIntelligenceHealthScore },
    { name: "classifySeoHealthBand", fn: classifySeoHealthBand },
    { name: "rankSeoRecommendations", fn: rankSeoRecommendations },
    { name: "assignSeoRecommendationGroup", fn: assignSeoRecommendationGroup },
    { name: "estimateSeoImpact", fn: estimateSeoImpact },
    { name: "calculateSeoIntelligenceScores", fn: calculateSeoIntelligenceScores },
  ];

  for (const item of exports) {
    it(`exports ${item.name} as callable`, () => {
      expect(typeof item.fn).toBe("function");
    });
  }
});

describe("SEO intelligence impact by category", () => {
  const categories = [
    "Metadata",
    "Technical SEO",
    "Images",
    "Accessibility",
    "Core Web Vitals",
    "Indexability",
    "Structured Data",
    "Internal Linking",
    "Conversion SEO",
  ] as const;

  for (const category of categories) {
    it(`estimates impact for ${category}`, () => {
      const impact = estimateSeoImpact({
        category,
        confidence: 0.85,
        sectionScore: 55,
      });
      expect(impact).toBeTruthy();
    });
  }
});

describe("SEO intelligence recommendation groups", () => {
  const groups = [
    { category: "Core Web Vitals", expected: "Critical Fixes", priorityScore: 80, hasDeterministicImpact: true },
    { category: "Technical SEO", expected: "Critical Fixes", priorityScore: 80, hasDeterministicImpact: true },
    { category: "Metadata", expected: "Organic Growth", priorityScore: 50, hasDeterministicImpact: false },
    { category: "Images", expected: "Quick Wins", priorityScore: 60, hasDeterministicImpact: true },
  ] as const;

  for (const item of groups) {
    it(`assigns ${item.category} recommendations to ${item.expected}`, () => {
      const group = assignSeoRecommendationGroup({
        category: item.category,
        priorityScore: item.priorityScore,
        hasDeterministicImpact: item.hasDeterministicImpact,
      });
      expect(group).toBe(item.expected);
    });
  }
});

describe("SEO intelligence health bands", () => {
  for (const score of [95, 75, 55, 25]) {
    it(`classifies score ${score}`, () => {
      const band = classifySeoHealthBand(score);
      expect(["strong", "watch", "weak"]).toContain(band);
    });
  }
});
