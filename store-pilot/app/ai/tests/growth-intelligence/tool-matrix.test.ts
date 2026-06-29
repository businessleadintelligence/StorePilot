import { describe, expect, it } from "vitest";

import { buildMockGrowthScores } from "./helpers";
import { GROWTH_INTELLIGENCE_GROUPS, GROWTH_INTELLIGENCE_CATEGORIES } from "../../schemas/growth-intelligence";
import { analyzeGrowthRetention, analyzeGrowthAov } from "../../tools/growth-section-tool";
import { calculateGrowthIntelligenceHealthScore } from "../../tools/growth-health-tool";
import { estimateGrowthImpact } from "../../tools/growth-impact-tool";
import { assignGrowthRecommendationGroup } from "../../tools/growth-group-tool";
import { areGrowthRecommendationsSimilar } from "../../tools/growth-similarity-tool";
import { buildGrowthIntelligenceEvidenceCatalog } from "../../agents/growth-intelligence-evidence";
import { buildGrowthIntelligenceFactsFromSnapshot } from "./helpers";

describe("Growth intelligence tool matrix", () => {
  for (const category of GROWTH_INTELLIGENCE_CATEGORIES) {
    it(`supports category ${category}`, () => {
      expect(category.length).toBeGreaterThan(2);
    });
  }

  for (const group of GROWTH_INTELLIGENCE_GROUPS) {
    it(`supports group ${group}`, () => {
      expect(group.length).toBeGreaterThan(2);
    });
  }

  it("scores weak retention lower than strong retention", () => {
    const weak = analyzeGrowthRetention({ repeatOrderProxy: 10, refundRate: 12 });
    const strong = analyzeGrowthRetention({ repeatOrderProxy: 38, refundRate: 3 });

    expect(weak.score).toBeLessThan(strong.score);
  });

  it("scores low AOV lower than high AOV", () => {
    const low = analyzeGrowthAov({ aov: 32, previousAov: 30 });
    const high = analyzeGrowthAov({ aov: 78, previousAov: 72 });

    expect(low.score).toBeLessThan(high.score);
  });

  it("calculates health score penalties for critical issues", () => {
    const lowIssues = calculateGrowthIntelligenceHealthScore({
      scores: buildMockGrowthScores({ growthHealthScore: 80 }),
      criticalIssueCount: 0,
    });
    const highIssues = calculateGrowthIntelligenceHealthScore({
      scores: buildMockGrowthScores({ growthHealthScore: 80 }),
      criticalIssueCount: 8,
    });

    expect(highIssues).toBeLessThan(lowIssues);
  });

  it("estimates revenue impact for upsell", () => {
    const impact = estimateGrowthImpact({
      category: "Upsell",
      confidence: 0.85,
      sectionScore: 50,
    });

    expect(impact.revenueIncrease).toBeGreaterThan(0);
  });

  it("assigns upsell group", () => {
    expect(
      assignGrowthRecommendationGroup({
        category: "Upsell",
        priorityScore: 80,
        hasDeterministicImpact: true,
      }),
    ).toBe("Immediate Revenue Wins");
  });

  it("detects similar growth recommendations", () => {
    expect(
      areGrowthRecommendationsSimilar(
        { category: "Upsell", title: "Launch upsell on hero products" },
        { category: "Upsell", title: "Launch upsell on hero products" },
      ),
    ).toBe(true);
  });

  it("builds evidence catalog with growth keys", async () => {
    const catalog = buildGrowthIntelligenceEvidenceCatalog(await buildGrowthIntelligenceFactsFromSnapshot());

    expect(catalog.some((entry) => entry.key === "revenue_opportunity")).toBe(true);
    expect(catalog.some((entry) => entry.key === "growth_health_score")).toBe(true);
  });
});
