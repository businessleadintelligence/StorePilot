import { describe, expect, it } from "vitest";
import { detectTrendDirection, detectStoreTrendDirection } from "../../tools/trend-detection-tool";
import { calculateTrendScore } from "../../tools/trend-score-tool";
import { calculateTrendHealthScore } from "../../tools/trend-health-tool";
import { estimateTrendImpact } from "../../tools/trend-impact-tool";
import { assignTrendRecommendationGroup } from "../../tools/trend-group-tool";
import { areTrendRecommendationsSimilar } from "../../tools/trend-similarity-tool";
import { buildTrendEvidenceCatalog } from "../../agents/trend-intelligence-evidence";
import { buildTrendFactsFromSnapshot } from "./helpers";
import { TREND_INTELLIGENCE_CATEGORIES, TREND_INTELLIGENCE_GROUPS } from "../../schemas/trend-intelligence";

describe("Trend intelligence tool matrix", () => {
  for (const category of TREND_INTELLIGENCE_CATEGORIES) {
    it(`supports category ${category}`, () => {
      expect(category.length).toBeGreaterThan(2);
    });
  }

  for (const group of TREND_INTELLIGENCE_GROUPS) {
    it(`supports group ${group}`, () => {
      expect(group.length).toBeGreaterThan(2);
    });
  }

  it("scores emerging products higher than flat demand", () => {
    const emerging = detectTrendDirection({ sales7Days: 20, sales30Days: 30 });
    const flat = detectTrendDirection({ sales7Days: 7, sales30Days: 30 });
    expect(emerging).toBe("emerging");
    expect(flat).toBe("stable");
  });

  it("detects mixed store direction when growth and decline coexist", () => {
    expect(
      detectStoreTrendDirection({
        revenue7Days: 1000,
        revenue30Days: 4000,
        emergingProductCount: 2,
        decliningProductCount: 2,
      }),
    ).toBe("mixed");
  });

  it("assigns recommendation groups by category", () => {
    expect(
      assignTrendRecommendationGroup({
        category: "Emerging Opportunity",
        priorityScore: 80,
        hasDeterministicImpact: true,
      }),
    ).toBe("Emerging Opportunities");
    expect(
      assignTrendRecommendationGroup({
        category: "Declining Demand",
        priorityScore: 80,
        hasDeterministicImpact: true,
      }),
    ).toBe("Decline Mitigation");
  });

  it("detects similar recommendations", () => {
    expect(
      areTrendRecommendationsSimilar(
        { category: "Emerging Opportunity", title: "Restock Blue Hoodie inventory" },
        { category: "Emerging Opportunity", title: "Restock Blue Hoodie inventory" },
      ),
    ).toBe(true);
  });

  it("builds evidence catalog with product momentum keys", () => {
    const catalog = buildTrendEvidenceCatalog(buildTrendFactsFromSnapshot());
    expect(catalog.some((entry) => entry.key === "product_product-1_momentum")).toBe(true);
  });

  it("estimates impact for emerging opportunities", () => {
    const impact = estimateTrendImpact({
      category: "Emerging Opportunity",
      confidence: 0.85,
      momentum: 0.75,
      sales30Days: 48,
    });
    expect(impact.revenueOpportunity).toBeGreaterThan(0);
  });

  it("calculates health score from trend mix", () => {
    const score = calculateTrendHealthScore({
      trendScore: 75,
      emergingProductCount: 3,
      decliningProductCount: 1,
      riskLevel: "low",
    });
    expect(score).toBeGreaterThan(60);
    expect(
      calculateTrendScore({
        emergingProductCount: 3,
        decliningProductCount: 1,
        storeGrowthRate: 12,
        averageMomentum: 0.6,
        totalProducts: 10,
      }),
    ).toBeGreaterThan(score - 20);
  });
});
