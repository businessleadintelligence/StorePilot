import { describe, expect, it } from "vitest";
import { analyzePricingMargin } from "../../tools/pricing-margin-tool";
import { analyzePricingDiscount } from "../../tools/pricing-discount-tool";
import { analyzePricingElasticity } from "../../tools/pricing-elasticity-tool";
import { analyzePricingPsychology } from "../../tools/pricing-psychology-tool";
import { analyzePricingPremium } from "../../tools/pricing-premium-tool";
import { analyzePricingCompetition } from "../../tools/pricing-competition-tool";
import { analyzePricingInventory } from "../../tools/pricing-inventory-tool";
import { analyzePricingRevenue } from "../../tools/pricing-revenue-tool";
import { analyzePricingProfit } from "../../tools/pricing-profit-tool";
import { analyzePricingDemand } from "../../tools/pricing-demand-tool";
import { analyzePricingConversion } from "../../tools/pricing-conversion-tool";
import { analyzePricingBundle } from "../../tools/pricing-bundle-tool";
import { analyzePricingRisk, analyzePriceConsistency } from "../../tools/pricing-risk-tool";
import {
  calculatePricingIntelligenceHealthScore,
  classifyPricingHealthBand,
} from "../../tools/pricing-health-tool";
import { rankPricingRecommendations } from "../../tools/pricing-ranking-tool";
import { assignPricingRecommendationGroup } from "../../tools/pricing-group-tool";
import { estimatePricingImpact } from "../../tools/pricing-impact-tool";
import { calculatePricingIntelligenceScores } from "../../tools/pricing-score-tool";

describe("Pricing intelligence tool exports", () => {
  const exports = [
    { name: "analyzePricingMargin", fn: analyzePricingMargin },
    { name: "analyzePricingDiscount", fn: analyzePricingDiscount },
    { name: "analyzePricingElasticity", fn: analyzePricingElasticity },
    { name: "analyzePricingPsychology", fn: analyzePricingPsychology },
    { name: "analyzePricingPremium", fn: analyzePricingPremium },
    { name: "analyzePricingCompetition", fn: analyzePricingCompetition },
    { name: "analyzePricingInventory", fn: analyzePricingInventory },
    { name: "analyzePricingRevenue", fn: analyzePricingRevenue },
    { name: "analyzePricingProfit", fn: analyzePricingProfit },
    { name: "analyzePricingDemand", fn: analyzePricingDemand },
    { name: "analyzePricingConversion", fn: analyzePricingConversion },
    { name: "analyzePricingBundle", fn: analyzePricingBundle },
    { name: "analyzePricingRisk", fn: analyzePricingRisk },
    { name: "analyzePriceConsistency", fn: analyzePriceConsistency },
    { name: "calculatePricingIntelligenceHealthScore", fn: calculatePricingIntelligenceHealthScore },
    { name: "classifyPricingHealthBand", fn: classifyPricingHealthBand },
    { name: "rankPricingRecommendations", fn: rankPricingRecommendations },
    { name: "assignPricingRecommendationGroup", fn: assignPricingRecommendationGroup },
    { name: "estimatePricingImpact", fn: estimatePricingImpact },
    { name: "calculatePricingIntelligenceScores", fn: calculatePricingIntelligenceScores },
  ];

  for (const item of exports) {
    it(`exports ${item.name} as callable`, () => {
      expect(typeof item.fn).toBe("function");
    });
  }
});

describe("Pricing intelligence impact by category", () => {
  const categories = [
    "Margin Protection",
    "Discount Optimization",
    "Premium Pricing",
    "Inventory Pricing",
    "Bundle Pricing",
    "Revenue Optimization",
    "Conversion Pricing",
    "Loss Leader Strategy",
  ] as const;

  for (const category of categories) {
    it(`estimates impact for ${category}`, () => {
      const impact = estimatePricingImpact({
        category,
        confidence: 0.85,
        sectionScore: 55,
      });
      expect(impact).toBeTruthy();
    });
  }
});

describe("Pricing intelligence recommendation groups", () => {
  const groups = [
    { category: "Margin Protection", expected: "Critical Pricing Risks", priorityScore: 80, hasDeterministicImpact: true },
    { category: "Premium Pricing", expected: "Premium Pricing", priorityScore: 50, hasDeterministicImpact: false },
    { category: "Discount Optimization", expected: "Discount Optimization", priorityScore: 50, hasDeterministicImpact: false },
    { category: "Bundle Pricing", expected: "Bundle Pricing", priorityScore: 60, hasDeterministicImpact: true },
  ] as const;

  for (const item of groups) {
    it(`assigns ${item.category} recommendations to ${item.expected}`, () => {
      const group = assignPricingRecommendationGroup({
        category: item.category,
        priorityScore: item.priorityScore,
        hasDeterministicImpact: item.hasDeterministicImpact,
      });
      expect(group).toBe(item.expected);
    });
  }
});

describe("Pricing intelligence health bands", () => {
  for (const score of [95, 75, 55, 25]) {
    it(`classifies score ${score}`, () => {
      const band = classifyPricingHealthBand(score);
      expect(["strong", "watch", "weak"]).toContain(band);
    });
  }
});
