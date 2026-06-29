import { describe, expect, it } from "vitest";
import {
  analyzeGrowthAcquisition,
  analyzeGrowthRetention,
  analyzeGrowthAov,
  analyzeGrowthUpsell,
} from "../../tools/growth-section-tool";
import { analyzeGrowthOpportunity } from "../../tools/growth-opportunity-tool";
import { analyzeGrowthCapacity } from "../../tools/growth-capacity-tool";
import { analyzeGrowthRisk } from "../../tools/growth-risk-tool";
import { calculateGrowthRate } from "../../tools/growth-rate-tool";
import {
  calculateGrowthIntelligenceHealthScore,
  classifyGrowthHealthBand,
} from "../../tools/growth-health-tool";
import { rankGrowthRecommendations } from "../../tools/growth-ranking-tool";
import { assignGrowthRecommendationGroup } from "../../tools/growth-group-tool";
import { estimateGrowthImpact } from "../../tools/growth-impact-tool";
import { calculateGrowthIntelligenceScores } from "../../tools/growth-score-tool";

describe("Growth intelligence tool exports", () => {
  const exports = [
    { name: "analyzeGrowthAcquisition", fn: analyzeGrowthAcquisition },
    { name: "analyzeGrowthRetention", fn: analyzeGrowthRetention },
    { name: "analyzeGrowthAov", fn: analyzeGrowthAov },
    { name: "analyzeGrowthUpsell", fn: analyzeGrowthUpsell },
    { name: "analyzeGrowthOpportunity", fn: analyzeGrowthOpportunity },
    { name: "analyzeGrowthCapacity", fn: analyzeGrowthCapacity },
    { name: "analyzeGrowthRisk", fn: analyzeGrowthRisk },
    { name: "calculateGrowthRate", fn: calculateGrowthRate },
    { name: "calculateGrowthIntelligenceHealthScore", fn: calculateGrowthIntelligenceHealthScore },
    { name: "classifyGrowthHealthBand", fn: classifyGrowthHealthBand },
    { name: "rankGrowthRecommendations", fn: rankGrowthRecommendations },
    { name: "assignGrowthRecommendationGroup", fn: assignGrowthRecommendationGroup },
    { name: "estimateGrowthImpact", fn: estimateGrowthImpact },
    { name: "calculateGrowthIntelligenceScores", fn: calculateGrowthIntelligenceScores },
  ];

  for (const item of exports) {
    it(`exports ${item.name} as callable`, () => {
      expect(typeof item.fn).toBe("function");
    });
  }
});

describe("Growth intelligence impact by category", () => {
  const categories = [
    "Revenue Growth",
    "AOV Growth",
    "Upsell",
    "Cross-sell",
    "Retention",
    "Repeat Purchases",
    "Collections",
    "Campaigns",
  ] as const;

  for (const category of categories) {
    it(`estimates impact for ${category}`, () => {
      const impact = estimateGrowthImpact({
        category,
        confidence: 0.85,
        sectionScore: 55,
      });
      expect(impact).toBeTruthy();
    });
  }
});

describe("Growth intelligence recommendation groups", () => {
  const groups = [
    { category: "Upsell", expected: "Immediate Revenue Wins", priorityScore: 80, hasDeterministicImpact: true },
    { category: "Retention", expected: "Retention", priorityScore: 50, hasDeterministicImpact: false },
    { category: "Repeat Purchases", expected: "Repeat Purchases", priorityScore: 50, hasDeterministicImpact: false },
    { category: "Collections", expected: "Collections", priorityScore: 60, hasDeterministicImpact: true },
  ] as const;

  for (const item of groups) {
    it(`assigns ${item.category} recommendations to ${item.expected}`, () => {
      const group = assignGrowthRecommendationGroup({
        category: item.category,
        priorityScore: item.priorityScore,
        hasDeterministicImpact: item.hasDeterministicImpact,
      });
      expect(group).toBe(item.expected);
    });
  }
});

describe("Growth intelligence health bands", () => {
  for (const score of [95, 75, 55, 25]) {
    it(`classifies score ${score}`, () => {
      const band = classifyGrowthHealthBand(score);
      expect(["strong", "watch", "weak"]).toContain(band);
    });
  }
});
