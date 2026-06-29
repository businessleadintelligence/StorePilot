import { describe, expect, it } from "vitest";

import { buildMockPricingScores } from "./helpers";
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
import { arePricingRecommendationsSimilar } from "../../tools/pricing-similarity-tool";
import { assignPricingRecommendationGroup } from "../../tools/pricing-group-tool";
import { estimatePricingImpact } from "../../tools/pricing-impact-tool";
import { calculatePricingIntelligenceScores } from "../../tools/pricing-score-tool";

describe("Pricing intelligence spec-named tools", () => {
  it("scores thin margin lower in margin tool", () => {
    const weak = analyzePricingMargin({ totalRevenue: 10000, estimatedCostRatio: 0.78 });
    const strong = analyzePricingMargin({ totalRevenue: 10000, estimatedCostRatio: 0.42 });
    expect(weak.marginPercent).toBeLessThan(strong.marginPercent);
    expect(weak.issues.length).toBeGreaterThan(0);
  });

  it("analyzes discount dependence through discount tool", () => {
    const result = analyzePricingDiscount({
      averageDiscountPercent: 26,
      discountFrequency: 68,
      discountedOrderCount: 68,
      totalOrders: 100,
    });
    expect(result.issues).toContain("discount_abuse_risk");
    expect(result.score).toBeLessThan(70);
  });

  it("analyzes elasticity and price sensitivity", () => {
    const result = analyzePricingElasticity({
      averageDiscountPercent: 22,
      velocityTrend: 0.15,
      conversionRate: 0.025,
    });
    expect(result.elasticityScore).toBeGreaterThan(0);
  });

  it("analyzes psychological pricing endings", () => {
    const result = analyzePricingPsychology({ prices: [20, 35, 50, 80] });
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("flags premium positioning opportunities", () => {
    const result = analyzePricingPremium({
      highVelocityProducts: 4,
      lowDiscountProducts: 5,
      averageMarginPercent: 38,
      totalProducts: 10,
    });
    expect(result.opportunityCount).toBeGreaterThan(0);
  });

  it("analyzes competitive price positioning", () => {
    const result = analyzePricingCompetition({ medianPrice: 40, prices: [20, 35, 40, 55, 90] });
    expect(result.underpricedCount + result.overpricedCount).toBeGreaterThan(0);
  });

  it("analyzes inventory pricing pressure", () => {
    const weak = analyzePricingInventory({
      averageWeeksOfCover: 16,
      slowMoverCount: 6,
      fastMoverCount: 2,
      totalProducts: 10,
    });
    const strong = analyzePricingInventory({
      averageWeeksOfCover: 4,
      slowMoverCount: 1,
      fastMoverCount: 5,
      totalProducts: 10,
    });
    expect(weak.score).toBeLessThan(strong.score);
  });

  it("analyzes revenue trend risk", () => {
    const result = analyzePricingRevenue({ totalRevenue: 9000, previousRevenue: 12000, aov: 22 });
    expect(result.revenueTrend).toBeLessThan(0);
  });

  it("analyzes profit trend risk", () => {
    const result = analyzePricingProfit({ grossProfit: 3200, previousGrossProfit: 4200, marginPercent: 28 });
    expect(result.profitTrend).toBeLessThan(0);
  });

  it("analyzes demand strength", () => {
    const result = analyzePricingDemand({ totalUnitsSold: 80, totalProducts: 10, velocity: 2.5 });
    expect(result.demandScore).toBeGreaterThan(0);
  });

  it("analyzes conversion pricing friction", () => {
    const result = analyzePricingConversion({ conversionRate: 0.015, averageDiscountPercent: 24 });
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("analyzes bundle pricing opportunity", () => {
    const result = analyzePricingBundle({ bundleCandidateCount: 4, attachRateProxy: 0.35, totalProducts: 10 });
    expect(result.bundlePriceOpportunity).toBeGreaterThan(0);
  });

  it("analyzes composite pricing risk", () => {
    const result = analyzePricingRisk({
      revenueRisk: 55,
      profitRisk: 60,
      inventoryRisk: 45,
      discountDependence: 62,
    });
    expect(result.score).toBeGreaterThan(40);
  });

  it("analyzes price consistency", () => {
    const result = analyzePriceConsistency({ prices: [19.99, 24.99, 89.99, 129.99] });
    expect(result.priceConsistencyScore).toBeGreaterThanOrEqual(0);
  });

  it("calculates pricing health score with penalties", () => {
    const score = calculatePricingIntelligenceHealthScore({
      scores: buildMockPricingScores({ pricingHealthScore: 80 }),
      criticalIssueCount: 5,
    });
    expect(score).toBeLessThan(80);
    expect(classifyPricingHealthBand(score)).toBe("watch");
  });

  it("ranks pricing recommendations by priority score", () => {
    const ranked = rankPricingRecommendations([
      { id: "a", priorityScore: 40, confidence: 0.8 },
      { id: "b", priorityScore: 90, confidence: 0.9 },
    ]);
    expect(ranked[0]?.id).toBe("b");
  });

  it("detects similar pricing recommendations", () => {
    expect(
      arePricingRecommendationsSimilar(
        { category: "Premium Pricing", title: "Raise prices on premium candidates" },
        { category: "Premium Pricing", title: "Raise prices on premium candidates" },
      ),
    ).toBe(true);
  });

  it("assigns discount recommendations to discount optimization group", () => {
    expect(
      assignPricingRecommendationGroup({
        category: "Discount Optimization",
        priorityScore: 50,
        hasDeterministicImpact: false,
      }),
    ).toBe("Discount Optimization");
  });

  it("estimates margin protection impact", () => {
    const impact = estimatePricingImpact({
      category: "Margin Protection",
      confidence: 0.9,
      sectionScore: 55,
    });
    expect(impact.profitIncrease ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe("Pricing intelligence tool score boundaries", () => {
  const tools: Array<{ run: () => unknown; field: string }> = [
    { run: () => analyzePricingMargin({ totalRevenue: 0, estimatedCostRatio: 0.58 }), field: "marginPercent" },
    {
      run: () =>
        analyzePricingDiscount({
          averageDiscountPercent: 0,
          discountFrequency: 0,
          discountedOrderCount: 0,
          totalOrders: 0,
        }),
      field: "score",
    },
    {
      run: () => analyzePricingElasticity({ averageDiscountPercent: 0, velocityTrend: 0, conversionRate: 0 }),
      field: "elasticityScore",
    },
    { run: () => analyzePricingPsychology({ prices: [] }), field: "score" },
    {
      run: () =>
        analyzePricingPremium({
          highVelocityProducts: 0,
          lowDiscountProducts: 0,
          averageMarginPercent: 0,
          totalProducts: 0,
        }),
      field: "score",
    },
    { run: () => analyzePricingCompetition({ medianPrice: 0, prices: [] }), field: "score" },
    {
      run: () =>
        analyzePricingInventory({
          averageWeeksOfCover: 0,
          slowMoverCount: 0,
          fastMoverCount: 0,
          totalProducts: 0,
        }),
      field: "score",
    },
    {
      run: () => analyzePricingRevenue({ totalRevenue: 0, previousRevenue: 0, aov: 0 }),
      field: "revenueRisk",
    },
    {
      run: () => {
        const scores = calculatePricingIntelligenceScores({
          totalRevenue: 0,
          totalGrossProfit: 0,
          inventoryCost: 0,
          inventoryCoverage: 0,
          revenuePerVisitor: 0,
          conversionRate: 0,
          aov: 0,
          marginPercent: 0,
          averageDiscountPercent: 0,
          discountFrequency: 0,
          pricePositionScore: 50,
          markdownPercent: 0,
          sellThrough: 0,
          profitTrend: 0,
          velocity: 0,
          inventoryRisk: 0,
          bundlePriceOpportunity: 0,
          premiumPricingOpportunity: 0,
          psychologicalPricingOpportunity: 0,
          priceConsistencyScore: 50,
          discountDependence: 0,
          revenueRisk: 0,
          profitRisk: 0,
          elasticityRisk: 0,
        });
        return { score: scores.pricingHealthScore };
      },
      field: "score",
    },
  ];

  for (const [index, tool] of tools.entries()) {
    it(`keeps tool ${index + 1} score within 0-100`, () => {
      const result = tool.run() as Record<string, number>;
      const value = result[tool.field];
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });
  }
});
