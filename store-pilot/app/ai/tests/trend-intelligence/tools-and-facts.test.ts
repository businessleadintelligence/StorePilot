import { describe, expect, it } from "vitest";
import { createEmptyTrendProviderRegistry } from "../../trends/trend-provider";
import { detectTrendDirection } from "../../tools/trend-detection-tool";
import { calculateTrendScore } from "../../tools/trend-score-tool";
import { detectSeasonality } from "../../tools/seasonality-tool";
import { calculateMomentum } from "../../tools/momentum-tool";
import { calculateGrowthRate, calculateRollingGrowth } from "../../tools/growth-rate-tool";
import { detectDecliningProducts, calculateDeclineRate } from "../../tools/decline-detector-tool";
import { detectOpportunityGaps } from "../../tools/opportunity-gap-tool";
import { inferProductCategory, buildCategoryTrends } from "../../tools/category-trend-tool";
import { buildProductTrend, rankProductTrends } from "../../tools/product-trend-tool";
import { assessTrendRisk } from "../../tools/trend-risk-tool";
import { calculateTrendPriorityScore } from "../../tools/trend-ranking-tool";
import { assignTrendRecommendationGroup } from "../../tools/trend-group-tool";
import { dedupeSimilarTrendRecommendations } from "../../tools/trend-similarity-tool";
import { estimateTrendImpact } from "../../tools/trend-impact-tool";
import { calculateTrendHealthScore } from "../../tools/trend-health-tool";
import { createTrendFactsBuilder } from "../../facts/trend-facts";
import { buildTrendEvidenceCatalog } from "../../agents/trend-intelligence-evidence";
import { createMockTrendSnapshot, buildTrendFactsFromSnapshot } from "./helpers";

describe("Trend intelligence deterministic tools", () => {
  it("detects emerging and declining directions", () => {
    expect(detectTrendDirection({ sales7Days: 20, sales30Days: 30 })).toBe("emerging");
    expect(detectTrendDirection({ sales7Days: 2, sales30Days: 30 })).toBe("declining");
  });

  it("calculates trend score from product mix", () => {
    expect(
      calculateTrendScore({
        emergingProductCount: 3,
        decliningProductCount: 1,
        storeGrowthRate: 12,
        averageMomentum: 0.6,
        totalProducts: 10,
      }),
    ).toBeGreaterThan(60);
  });

  it("detects seasonality peaks", () => {
    const seasonality = detectSeasonality({
      salesByMonth: [
        { month: 4, quantity: 20 },
        { month: 5, quantity: 25 },
        { month: 6, quantity: 50 },
      ],
    });
    expect(seasonality.peakMonth).toBe(6);
    expect(seasonality.signals.length).toBeGreaterThan(0);
  });

  it("calculates momentum and growth rates", () => {
    expect(calculateMomentum({ sales7Days: 14, sales30Days: 30, velocity: 1 })).toBeGreaterThan(0);
    expect(calculateGrowthRate({ currentPeriod: 15, priorPeriod: 10 })).toBe(50);
    expect(
      calculateRollingGrowth({ sales7Days: 20, sales30Days: 60, salesPrior30Days: 40 }).mediumTermGrowthRate,
    ).toBeGreaterThan(0);
  });

  it("detects declining products and decline rate", () => {
    const declining = detectDecliningProducts([
      { productId: "a", direction: "declining" },
      { productId: "b", direction: "emerging" },
    ]);
    expect(declining).toHaveLength(1);
    expect(calculateDeclineRate({ decliningProductCount: 2, totalProducts: 10 })).toBe(20);
  });

  it("detects opportunity gaps", () => {
    const gaps = detectOpportunityGaps({
      emergingProductCount: 3,
      decliningProductCount: 1,
      lowInventoryEmergingCount: 1,
      uncapturedCategoryCount: 1,
    });
    expect(gaps.level).toBe("high");
    expect(gaps.gaps.length).toBeGreaterThan(0);
  });

  it("builds category and product trends", () => {
    expect(inferProductCategory("Blue Hoodie")).toBe("Blue");
    const categories = buildCategoryTrends([
      {
        title: "Blue Hoodie",
        sales7Days: 10,
        sales30Days: 20,
        velocity: 1,
        direction: "emerging",
      },
    ]);
    expect(categories[0]?.category).toBe("Blue");
    const product = buildProductTrend({
      productId: "p1",
      title: "Blue Hoodie",
      sales7Days: 10,
      sales30Days: 20,
      salesPrior30Days: 10,
      velocity: 1,
    });
    expect(rankProductTrends([product])[0]?.productId).toBe("p1");
  });

  it("assesses risk and ranks recommendations", () => {
    expect(
      assessTrendRisk({ decliningProductCount: 6, declineRate: 45, storeGrowthRate: -25 }),
    ).toBe("high");
    expect(
      assignTrendRecommendationGroup({
        category: "Seasonal Trend",
        priorityScore: 70,
        hasDeterministicImpact: true,
      }),
    ).toBe("Seasonal Plays");
    expect(
      calculateTrendPriorityScore({
        confidence: 0.9,
        difficultyWeight: 1,
        impact: { revenueOpportunity: 100, unitsProtected: null, demandLift: null, inventoryAlignment: null },
        momentum: 0.8,
      }),
    ).toBeGreaterThan(50);
  });

  it("dedupes similar recommendations and estimates impact", () => {
    const deduped = dedupeSimilarTrendRecommendations([
      { category: "Emerging Opportunity", title: "Restock hoodie", confidence: 0.7 },
      { category: "Emerging Opportunity", title: "Restock hoodie", confidence: 0.9 },
    ]);
    expect(deduped).toHaveLength(1);
    expect(
      estimateTrendImpact({
        category: "Emerging Opportunity",
        confidence: 0.8,
        momentum: 0.7,
        sales30Days: 20,
      }).revenueOpportunity,
    ).toBeGreaterThan(0);
  });

  it("builds facts from snapshot source", async () => {
    const snapshot = createMockTrendSnapshot();
    const facts = await createTrendFactsBuilder({
      async getStoreTrendSnapshot() {
        return snapshot;
      },
    }).build({ storeId: "store-1" });
    expect(facts.trendHealthScore).toBeGreaterThan(0);
    expect(facts.emergingProductIds.length + facts.decliningProductIds.length).toBeGreaterThan(0);
  });

  it("builds evidence catalog from facts", () => {
    const catalog = buildTrendEvidenceCatalog(buildTrendFactsFromSnapshot());
    expect(catalog.some((entry) => entry.key === "trend_health_score")).toBe(true);
  });

  it("calculates trend health score", () => {
    expect(
      calculateTrendHealthScore({
        trendScore: 70,
        emergingProductCount: 2,
        decliningProductCount: 1,
        riskLevel: "medium",
      }),
    ).toBeGreaterThan(50);
  });

  it("uses empty provider registry by default", async () => {
    const registry = createEmptyTrendProviderRegistry();
    expect(await registry.getAvailableProviders()).toEqual([]);
  });
});
