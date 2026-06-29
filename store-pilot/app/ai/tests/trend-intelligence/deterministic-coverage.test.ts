import { describe, expect, it } from "vitest";
import { detectTrendDirection, detectStoreTrendDirection } from "../../tools/trend-detection-tool";
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
import { validateTrendEvidenceKeys } from "../../agents/trend-intelligence-evidence";
import { buildTrendEvidenceCatalog } from "../../agents/trend-intelligence-evidence";
import { buildTrendFactsFromSnapshot } from "./helpers";

describe("Trend intelligence deterministic coverage", () => {
  const toolCases = [
    {
      name: "emerging product direction",
      run: () => detectTrendDirection({ sales7Days: 18, sales30Days: 30 }),
      assert: (result: ReturnType<typeof detectTrendDirection>) => expect(result).toBe("emerging"),
    },
    {
      name: "declining product direction",
      run: () => detectTrendDirection({ sales7Days: 1, sales30Days: 30 }),
      assert: (result: ReturnType<typeof detectTrendDirection>) => expect(result).toBe("declining"),
    },
    {
      name: "mixed store direction",
      run: () =>
        detectStoreTrendDirection({
          revenue7Days: 900,
          revenue30Days: 3600,
          emergingProductCount: 2,
          decliningProductCount: 2,
        }),
      assert: (result: ReturnType<typeof detectStoreTrendDirection>) => expect(result).toBe("mixed"),
    },
    {
      name: "strong trend score",
      run: () =>
        calculateTrendScore({
          emergingProductCount: 4,
          decliningProductCount: 0,
          storeGrowthRate: 20,
          averageMomentum: 0.8,
          totalProducts: 10,
        }),
      assert: (result: number) => expect(result).toBeGreaterThan(70),
    },
    {
      name: "seasonality peak",
      run: () =>
        detectSeasonality({
          salesByMonth: [
            { month: 3, quantity: 10 },
            { month: 4, quantity: 15 },
            { month: 5, quantity: 40 },
          ],
        }),
      assert: (result: ReturnType<typeof detectSeasonality>) => expect(result.peakMonth).toBe(5),
    },
    {
      name: "momentum positive",
      run: () => calculateMomentum({ sales7Days: 14, sales30Days: 28, velocity: 1.2 }),
      assert: (result: number) => expect(result).toBeGreaterThan(0.4),
    },
    {
      name: "growth rate positive",
      run: () => calculateGrowthRate({ currentPeriod: 120, priorPeriod: 100 }),
      assert: (result: number) => expect(result).toBe(20),
    },
    {
      name: "rolling growth",
      run: () =>
        calculateRollingGrowth({ sales7Days: 30, sales30Days: 90, salesPrior30Days: 70 }),
      assert: (result: ReturnType<typeof calculateRollingGrowth>) =>
        expect(result.mediumTermGrowthRate).toBeGreaterThan(0),
    },
    {
      name: "declining products",
      run: () =>
        detectDecliningProducts([
          { productId: "a", direction: "declining" },
          { productId: "b", direction: "stable" },
        ]),
      assert: (result: ReturnType<typeof detectDecliningProducts>) => expect(result).toHaveLength(1),
    },
    {
      name: "decline rate",
      run: () => calculateDeclineRate({ decliningProductCount: 3, totalProducts: 12 }),
      assert: (result: number) => expect(result).toBe(25),
    },
    {
      name: "opportunity gaps high",
      run: () =>
        detectOpportunityGaps({
          emergingProductCount: 4,
          decliningProductCount: 1,
          lowInventoryEmergingCount: 2,
          uncapturedCategoryCount: 1,
        }),
      assert: (result: ReturnType<typeof detectOpportunityGaps>) => expect(result.level).toBe("high"),
    },
    {
      name: "category trends",
      run: () =>
        buildCategoryTrends([
          {
            title: "Blue Hoodie",
            sales7Days: 10,
            sales30Days: 20,
            velocity: 1,
            direction: "emerging",
          },
        ]),
      assert: (result: ReturnType<typeof buildCategoryTrends>) =>
        expect(result[0]?.category).toBe("Blue"),
    },
    {
      name: "product trend ranking",
      run: () =>
        rankProductTrends([
          buildProductTrend({
            productId: "p1",
            title: "Blue Hoodie",
            sales7Days: 10,
            sales30Days: 20,
            salesPrior30Days: 8,
            velocity: 1,
          }),
        ]),
      assert: (result: ReturnType<typeof rankProductTrends>) => expect(result[0]?.productId).toBe("p1"),
    },
    {
      name: "trend risk high",
      run: () => assessTrendRisk({ decliningProductCount: 8, declineRate: 50, storeGrowthRate: -15 }),
      assert: (result: ReturnType<typeof assessTrendRisk>) => expect(result).toBe("high"),
    },
    {
      name: "priority score",
      run: () =>
        calculateTrendPriorityScore({
          confidence: 0.9,
          difficultyWeight: 1,
          impact: {
            revenueOpportunity: 200,
            unitsProtected: null,
            demandLift: null,
            inventoryAlignment: null,
          },
          momentum: 0.8,
        }),
      assert: (result: number) => expect(result).toBeGreaterThan(50),
    },
    {
      name: "group assignment",
      run: () =>
        assignTrendRecommendationGroup({
          category: "Seasonal Trend",
          priorityScore: 70,
          hasDeterministicImpact: true,
        }),
      assert: (result: ReturnType<typeof assignTrendRecommendationGroup>) =>
        expect(result).toBe("Seasonal Plays"),
    },
    {
      name: "similarity dedupe",
      run: () =>
        dedupeSimilarTrendRecommendations([
          { category: "Emerging Opportunity", title: "Restock hoodie", confidence: 0.7 },
          { category: "Emerging Opportunity", title: "Restock hoodie", confidence: 0.9 },
        ]),
      assert: (result: ReturnType<typeof dedupeSimilarTrendRecommendations>) =>
        expect(result).toHaveLength(1),
    },
    {
      name: "impact estimation",
      run: () =>
        estimateTrendImpact({
          category: "Declining Demand",
          confidence: 0.8,
          momentum: 0.8,
          sales30Days: 100,
        }),
      assert: (result: ReturnType<typeof estimateTrendImpact>) =>
        expect(result.unitsProtected).toBeGreaterThan(0),
    },
    {
      name: "health score",
      run: () =>
        calculateTrendHealthScore({
          trendScore: 68,
          emergingProductCount: 2,
          decliningProductCount: 1,
          riskLevel: "medium",
        }),
      assert: (result: number) => expect(result).toBeGreaterThan(50),
    },
  ];

  for (const toolCase of toolCases) {
    it(`covers ${toolCase.name}`, () => {
      const result = toolCase.run();
      toolCase.assert(result as never);
    });
  }

  it("validates evidence keys against catalog", () => {
    const facts = buildTrendFactsFromSnapshot();
    const catalog = buildTrendEvidenceCatalog(facts);
    expect(() => validateTrendEvidenceKeys(["trend_health_score"], catalog)).not.toThrow();
    expect(() => validateTrendEvidenceKeys(["missing_key"], catalog)).toThrow();
  });

  it("infers product category from title", () => {
    expect(inferProductCategory("Blue Hoodie")).toBe("Blue");
    expect(inferProductCategory("")).toBe("General");
  });
});
