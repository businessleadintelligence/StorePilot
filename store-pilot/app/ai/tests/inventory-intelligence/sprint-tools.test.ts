import { describe, expect, it } from "vitest";

import { buildAbcAnalysis, classifyAbcBand } from "../../tools/abc-analysis-tool";
import { buildXyzAnalysis, classifyXyzBand, calculateDemandCoefficientOfVariation } from "../../tools/xyz-analysis-tool";
import {
  calculateAverageWeeksOfCover,
  calculateWeeksOfCover,
  classifyStockCoverageBand,
} from "../../tools/stock-coverage-tool";
import {
  calculateAverageSellThroughRate,
  calculateSellThroughRate,
  classifySellThroughBand,
  identifyMoverProducts,
} from "../../tools/sell-through-tool";
import {
  buildInventoryRiskDistribution,
  calculateInventoryRiskScore,
  classifyInventoryRiskLevel,
} from "../../tools/inventory-risk-tool";
import {
  calculateReorderByDate,
  estimateLeadTimeDays,
  isReorderOverdue,
} from "../../tools/lead-time-tool";
import {
  calculateInventoryPriorityScore,
  deriveInventoryOverallPriorityFromScores,
  rankInventoryPriorityScores,
} from "../../tools/inventory-ranking-tool";
import {
  assignInventoryRecommendationGroup,
  buildInventoryRecommendationGroups,
} from "../../tools/inventory-group-tool";
import {
  areInventoryRecommendationsSimilar,
  dedupeSimilarInventoryRecommendations,
} from "../../tools/inventory-similarity-tool";

describe("Inventory Intelligence sprint tools", () => {
  it("classifies ABC bands and builds distribution", () => {
    expect(classifyAbcBand(0.5)).toBe("A");
    expect(classifyAbcBand(0.9)).toBe("B");
    expect(classifyAbcBand(0.99)).toBe("C");

    const analysis = buildAbcAnalysis([
      { productId: "a", title: "A", sales30Days: 100, unitCost: 10 },
      { productId: "b", title: "B", sales30Days: 20, unitCost: 10 },
      { productId: "c", title: "C", sales30Days: 5, unitCost: 10 },
    ]);

    expect(analysis.distribution.reduce((total, item) => total + item.value, 0)).toBe(3);
    expect(analysis.products[0]?.abcClass).toBe("A");
  });

  it("classifies XYZ variability", () => {
    expect(classifyXyzBand(0.2)).toBe("X");
    expect(classifyXyzBand(0.5)).toBe("Y");
    expect(classifyXyzBand(0.9)).toBe("Z");
    expect(calculateDemandCoefficientOfVariation([2, 2, 2, 2])).toBe(0);

    const analysis = buildXyzAnalysis([
      { productId: "a", title: "Stable", dailyQuantities: [2, 2, 2, 2] },
      { productId: "b", title: "Volatile", dailyQuantities: [0, 8, 1, 9] },
    ]);

    expect(analysis.products.some((product) => product.xyzClass === "X")).toBe(true);
  });

  it("calculates weeks of cover and stock coverage bands", () => {
    expect(calculateWeeksOfCover(21)).toBe(3);
    expect(calculateAverageWeeksOfCover([14, 28])).toBe(3);
    expect(classifyStockCoverageBand(1)).toBe("critical");
    expect(classifyStockCoverageBand(8)).toBe("healthy");
  });

  it("calculates sell-through and identifies movers", () => {
    expect(calculateSellThroughRate({ unitsSold: 30, availableInventory: 10 })).toBe(0.75);
    expect(classifySellThroughBand(0.75)).toBe("fast");
    expect(
      calculateAverageSellThroughRate([
        { unitsSold: 20, availableInventory: 10 },
        { unitsSold: 5, availableInventory: 20 },
      ]),
    ).toBeGreaterThan(0);

    const movers = identifyMoverProducts([
      { productId: "fast", sellThroughRate: 0.8 },
      { productId: "slow", sellThroughRate: 0.1 },
    ]);

    expect(movers.fastMovers).toHaveLength(1);
    expect(movers.slowMovers).toHaveLength(1);
  });

  it("scores inventory risk and builds risk distribution", () => {
    const score = calculateInventoryRiskScore({
      stockRisk: "CRITICAL",
      overstockRisk: true,
      understockRisk: true,
      deadStock: true,
      agingDays: 120,
    });

    expect(classifyInventoryRiskLevel(score)).toBe("critical");
    expect(
      buildInventoryRiskDistribution({
        stockoutCount: 2,
        overstockCount: 1,
        deadStockCount: 1,
        understockCount: 3,
      }),
    ).toHaveLength(4);
  });

  it("estimates lead time and reorder timing", () => {
    expect(estimateLeadTimeDays({ velocity: 3, reorderUrgency: 1 })).toBe(7);
    const reorderBy = calculateReorderByDate({
      runOutDate: "2026-07-10T00:00:00.000Z",
      leadTimeDays: 7,
      computedAt: "2026-06-20T00:00:00.000Z",
    });

    expect(reorderBy).toBeTruthy();
    expect(
      isReorderOverdue({
        runOutDate: "2026-06-25T00:00:00.000Z",
        leadTimeDays: 14,
        computedAt: "2026-06-20T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("ranks inventory recommendations by priority score", () => {
    const ranked = rankInventoryPriorityScores([
      { id: "a", priorityScore: 55, confidence: 0.7 },
      { id: "b", priorityScore: 88, confidence: 0.9 },
    ] as Array<{ id: string; priorityScore: number; confidence: number }>);

    expect(ranked[0]?.id).toBe("b");
    expect(
      calculateInventoryPriorityScore({
        confidence: 0.9,
        difficulty: "Easy",
        impact: { ordersProtected: 10 },
        stockoutAlertCount: 2,
      }),
    ).toBeGreaterThan(80);
    expect(deriveInventoryOverallPriorityFromScores([88, 55])).toBe(1);
  });

  it("assigns inventory groups and dedupes similar recommendations", () => {
    expect(
      assignInventoryRecommendationGroup({
        category: "Stockout",
        priorityScore: 90,
        hasDeterministicImpact: true,
        stockoutAlertCount: 2,
      }),
    ).toBe("Critical Inventory Risks");

    const groups = buildInventoryRecommendationGroups([
      { id: "a", group: "Immediate Reorders" },
      { id: "b", group: "Cash Flow Opportunities" },
    ]);

    expect(groups.immediateReorders).toEqual(["a"]);
    expect(
      dedupeSimilarInventoryRecommendations([
        {
          category: "Reorder",
          title: "Reorder Blue Hoodie before stockout",
          confidence: 0.9,
        },
        {
          category: "Reorder",
          title: "Reorder Blue Hoodie inventory urgently",
          confidence: 0.8,
        },
      ]),
    ).toHaveLength(1);
    expect(
      areInventoryRecommendationsSimilar(
        { category: "Reorder", title: "Reorder Blue Hoodie before stockout" },
        { category: "Clearance", title: "Clear slow inventory" },
      ),
    ).toBe(false);
  });
});
