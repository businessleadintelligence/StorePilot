import { describe, expect, it } from "vitest";
import {
  analyzeAccessibility,
  analyzeAppBloat,
  analyzeCollections,
  analyzeConversionOptimization,
  analyzeImages,
  analyzeMobileExperience,
  analyzeNavigation,
  analyzePolicies,
  analyzeSeo,
  analyzeStoreSpeed,
  analyzeTechnicalSeo,
  analyzeThemePerformance,
  analyzeTrustSignals,
  analyzeMerchantBestPractices,
  calculateAuditHealthScore,
  classifyAuditHealthBand,
  rankAuditRecommendations,
  assignStoreAuditRecommendationGroup,
  estimateAuditImpact,
  areAuditRecommendationsSimilar,
} from "../../tools";

describe("Store audit tool barrel exports", () => {
  const exports = [
    { name: "analyzeStoreSpeed", fn: analyzeStoreSpeed },
    { name: "analyzeThemePerformance", fn: analyzeThemePerformance },
    { name: "analyzeNavigation", fn: analyzeNavigation },
    { name: "analyzeCollections", fn: analyzeCollections },
    { name: "analyzeSeo", fn: analyzeSeo },
    { name: "analyzeTechnicalSeo", fn: analyzeTechnicalSeo },
    { name: "analyzeImages", fn: analyzeImages },
    { name: "analyzeTrustSignals", fn: analyzeTrustSignals },
    { name: "analyzePolicies", fn: analyzePolicies },
    { name: "analyzeMerchantBestPractices", fn: analyzeMerchantBestPractices },
    { name: "analyzeMobileExperience", fn: analyzeMobileExperience },
    { name: "analyzeAccessibility", fn: analyzeAccessibility },
    { name: "analyzeConversionOptimization", fn: analyzeConversionOptimization },
    { name: "analyzeAppBloat", fn: analyzeAppBloat },
    { name: "calculateAuditHealthScore", fn: calculateAuditHealthScore },
    { name: "classifyAuditHealthBand", fn: classifyAuditHealthBand },
    { name: "rankAuditRecommendations", fn: rankAuditRecommendations },
    { name: "assignStoreAuditRecommendationGroup", fn: assignStoreAuditRecommendationGroup },
    { name: "estimateAuditImpact", fn: estimateAuditImpact },
    { name: "areAuditRecommendationsSimilar", fn: areAuditRecommendationsSimilar },
  ];

  for (const item of exports) {
    it(`exports ${item.name} from tools index`, () => {
      expect(typeof item.fn).toBe("function");
    });
  }
});

describe("Store audit impact by category", () => {
  const categories = [
    "SEO",
    "Technical SEO",
    "Images",
    "Accessibility",
    "Conversion Optimization",
    "Store Performance",
    "Policies",
    "Trust Signals",
    "Merchant Best Practices",
  ] as const;

  for (const category of categories) {
    it(`estimates impact for ${category}`, () => {
      const impact = estimateAuditImpact({
        category,
        confidence: 0.85,
        sectionScore: 55,
      });
      expect(impact).toBeTruthy();
    });
  }
});

describe("Store audit recommendation groups", () => {
  const groups = [
    { category: "SEO", expected: "SEO Improvements", priorityScore: 80 },
    { category: "Theme", expected: "Performance Improvements", priorityScore: 80 },
    { category: "Conversion Optimization", expected: "Long-Term CRO", priorityScore: 40 },
    { category: "Homepage", expected: "Quick Wins", priorityScore: 60 },
  ] as const;

  for (const item of groups) {
    it(`assigns ${item.category} recommendations to ${item.expected}`, () => {
      const group = assignStoreAuditRecommendationGroup({
        category: item.category,
        priorityScore: item.priorityScore,
        hasDeterministicImpact: true,
      });
      expect(group).toBe(item.expected);
    });
  }
});

describe("Store audit health bands", () => {
  for (const score of [95, 75, 55, 25]) {
    it(`classifies score ${score}`, () => {
      const band = classifyAuditHealthBand(score);
      expect(["strong", "watch", "weak"]).toContain(band);
    });
  }
});
