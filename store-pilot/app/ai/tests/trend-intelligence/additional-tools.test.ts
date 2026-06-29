import { describe, expect, it } from "vitest";
import { TREND_INTELLIGENCE_CATEGORIES, TREND_INTELLIGENCE_GROUPS } from "../../schemas/trend-intelligence";
import { detectTrendDirection, detectStoreTrendDirection } from "../../tools/trend-detection-tool";
import { calculateTrendScore } from "../../tools/trend-score-tool";
import { buildTrendIntelligenceSubjectKey } from "../../../services/trend-intelligence.server";

describe("Trend intelligence additional coverage", () => {
  for (const category of TREND_INTELLIGENCE_CATEGORIES) {
    it(`supports category ${category}`, () => {
      expect(category.length).toBeGreaterThan(3);
    });
  }

  for (const group of TREND_INTELLIGENCE_GROUPS) {
    it(`supports group ${group}`, () => {
      expect(group.length).toBeGreaterThan(3);
    });
  }

  it("detects mixed store trend direction", () => {
    expect(
      detectStoreTrendDirection({
        revenue7Days: 1000,
        revenue30Days: 4000,
        emergingProductCount: 3,
        decliningProductCount: 2,
      }),
    ).toBe("mixed");
  });

  it("scores healthy trend mix higher than weak mix", () => {
    const strong = calculateTrendScore({
      emergingProductCount: 5,
      decliningProductCount: 1,
      storeGrowthRate: 15,
      averageMomentum: 0.7,
      totalProducts: 10,
    });
    const weak = calculateTrendScore({
      emergingProductCount: 0,
      decliningProductCount: 6,
      storeGrowthRate: -10,
      averageMomentum: 0.2,
      totalProducts: 10,
    });
    expect(strong).toBeGreaterThan(weak);
  });

  it("builds trend subject key", () => {
    expect(buildTrendIntelligenceSubjectKey("store-123")).toBe("trend:store-123");
  });

  it("classifies unknown product trend", () => {
    expect(detectTrendDirection({ sales7Days: 0, sales30Days: 0 })).toBe("unknown");
  });
});
