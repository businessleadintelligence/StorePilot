import { describe, expect, it } from "vitest";

import { analyzePricingMargin } from "../../tools/pricing-margin-tool";
import { analyzePricingDiscount } from "../../tools/pricing-discount-tool";
import { analyzePricingElasticity } from "../../tools/pricing-elasticity-tool";
import { analyzePricingPsychology } from "../../tools/pricing-psychology-tool";
import { analyzePricingPremium } from "../../tools/pricing-premium-tool";
import { analyzePricingCompetition } from "../../tools/pricing-competition-tool";
import { analyzePricingInventory } from "../../tools/pricing-inventory-tool";
import { analyzePricingRevenue } from "../../tools/pricing-revenue-tool";
import { analyzePricingConversion } from "../../tools/pricing-conversion-tool";
import { calculatePricingIntelligenceHealthScore } from "../../tools/pricing-health-tool";
import { calculatePricingPriorityScore } from "../../tools/pricing-ranking-tool";
import { estimatePricingImpact } from "../../tools/pricing-impact-tool";
import { buildPricingRecommendationGroups } from "../../tools/pricing-group-tool";
import { dedupeSimilarPricingRecommendations } from "../../tools/pricing-similarity-tool";
import { validatePricingIntelligenceEvidenceKeys } from "../../agents/pricing-intelligence-evidence";
import { buildMockPricingScores } from "./helpers";

describe("Pricing intelligence deterministic coverage", () => {
  const toolCases = [
    {
      name: "margin healthy",
      run: () => analyzePricingMargin({ totalRevenue: 15000, estimatedCostRatio: 0.45 }),
      assert: (result: ReturnType<typeof analyzePricingMargin>) => expect(result.marginPercent).toBeGreaterThan(40),
    },
    {
      name: "discount healthy",
      run: () =>
        analyzePricingDiscount({
          averageDiscountPercent: 5,
          discountFrequency: 10,
          discountedOrderCount: 5,
          totalOrders: 50,
        }),
      assert: (result: ReturnType<typeof analyzePricingDiscount>) => expect(result.score).toBeGreaterThan(70),
    },
    {
      name: "elasticity stable",
      run: () =>
        analyzePricingElasticity({
          averageDiscountPercent: 8,
          velocityTrend: 0.05,
          conversionRate: 0.04,
        }),
      assert: (result: ReturnType<typeof analyzePricingElasticity>) => expect(result.elasticityScore).toBeGreaterThan(40),
    },
    {
      name: "psychology healthy",
      run: () => analyzePricingPsychology({ prices: [19.99, 29.99, 49.99] }),
      assert: (result: ReturnType<typeof analyzePricingPsychology>) => expect(result.score).toBeGreaterThanOrEqual(0),
    },
    {
      name: "premium healthy",
      run: () =>
        analyzePricingPremium({
          highVelocityProducts: 3,
          lowDiscountProducts: 4,
          averageMarginPercent: 42,
          totalProducts: 10,
        }),
      assert: (result: ReturnType<typeof analyzePricingPremium>) => expect(result.score).toBeGreaterThan(0),
    },
    {
      name: "competition balanced",
      run: () => analyzePricingCompetition({ medianPrice: 40, prices: [35, 38, 40, 42, 45] }),
      assert: (result: ReturnType<typeof analyzePricingCompetition>) => expect(result.score).toBeGreaterThan(70),
    },
    {
      name: "inventory healthy",
      run: () =>
        analyzePricingInventory({
          averageWeeksOfCover: 5,
          slowMoverCount: 1,
          fastMoverCount: 4,
          totalProducts: 10,
        }),
      assert: (result: ReturnType<typeof analyzePricingInventory>) => expect(result.score).toBeGreaterThan(50),
    },
    {
      name: "revenue growing",
      run: () => analyzePricingRevenue({ totalRevenue: 14000, previousRevenue: 12000, aov: 55 }),
      assert: (result: ReturnType<typeof analyzePricingRevenue>) => expect(result.revenueTrend).toBeGreaterThan(0),
    },
    {
      name: "conversion healthy",
      run: () => analyzePricingConversion({ conversionRate: 0.04, averageDiscountPercent: 8 }),
      assert: (result: ReturnType<typeof analyzePricingConversion>) => expect(result.score).toBeGreaterThan(40),
    },
  ] as const;

  for (const testCase of toolCases) {
    it(`covers ${testCase.name}`, () => {
      const result = testCase.run();
      testCase.assert(result as never);
    });
  }

  it("computes bounded health score", () => {
    const score = calculatePricingIntelligenceHealthScore({
      scores: buildMockPricingScores({ pricingHealthScore: 100 }),
      criticalIssueCount: 0,
    });

    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(80);
  });

  it("ranks high-confidence recommendations higher", () => {
    const high = calculatePricingPriorityScore({
      confidence: 0.95,
      difficultyWeight: 1,
      impact: { revenueIncrease: 5, profitIncrease: 4, marginImprovement: 0.05, roi: 0.1 },
      sectionScore: 40,
    });
    const low = calculatePricingPriorityScore({
      confidence: 0.2,
      difficultyWeight: 0.85,
      impact: { revenueIncrease: null, profitIncrease: null, marginImprovement: null, roi: null },
      sectionScore: 85,
    });

    expect(high).toBeGreaterThan(low);
  });

  it("groups recommendations into pricing buckets", () => {
    const groups = buildPricingRecommendationGroups([
      { id: "1", group: "Critical Pricing Risks" },
      { id: "2", group: "Long-Term Pricing Strategy" },
    ]);

    expect(groups.criticalPricingRisks).toEqual(["1"]);
    expect(groups.longTermPricingStrategy).toEqual(["2"]);
  });

  it("dedupes pricing recommendations by category and title", () => {
    const deduped = dedupeSimilarPricingRecommendations([
      { category: "Discount Optimization", title: "Reduce blanket discounting", confidence: 0.7 },
      { category: "Discount Optimization", title: "Reduce blanket discounting", confidence: 0.85 },
    ]);

    expect(deduped).toHaveLength(1);
  });

  it("validates evidence keys in catalog map", () => {
    const catalog = [
      {
        key: "pricing_health_score",
        label: "Pricing health score",
        value: "68/100",
        factPath: "pricingHealthScore",
        section: "Overview",
      },
    ];

    expect(() => validatePricingIntelligenceEvidenceKeys(["pricing_health_score"], catalog)).not.toThrow();
    expect(() => validatePricingIntelligenceEvidenceKeys(["missing"], catalog)).toThrow();
  });

  it("estimates discount optimization impact", () => {
    const impact = estimatePricingImpact({
      category: "Discount Optimization",
      confidence: 0.8,
      sectionScore: 55,
    });

    expect(impact.profitIncrease).toBeGreaterThan(0);
  });

  it("estimates bundle pricing impact", () => {
    const impact = estimatePricingImpact({
      category: "Bundle Pricing",
      confidence: 0.75,
      sectionScore: 50,
    });

    expect(impact.roi).toBeGreaterThan(0);
  });
});

describe("Pricing intelligence category impact matrix", () => {
  for (const category of [
    "Margin Protection",
    "Discount Optimization",
    "Premium Pricing",
    "Inventory Pricing",
    "Bundle Pricing",
    "Psychological Pricing",
    "Price Consistency",
    "Revenue Optimization",
    "Conversion Pricing",
    "Markdown Timing",
    "Competitive Pricing",
    "Loss Leader Strategy",
  ] as const) {
    it(`estimates bounded impact for ${category}`, () => {
      const impact = estimatePricingImpact({
        category,
        confidence: 0.82,
        sectionScore: 48,
      });

      expect(impact).toBeDefined();
      if (["Revenue Optimization", "Conversion Pricing", "Bundle Pricing", "Premium Pricing"].includes(category)) {
        expect(impact.revenueIncrease).not.toBeNull();
      }
      if (["Margin Protection", "Discount Optimization", "Loss Leader Strategy"].includes(category)) {
        expect(impact.profitIncrease).not.toBeNull();
      }
    });
  }
});

describe("Pricing intelligence margin scenarios", () => {
  for (const costRatio of [0.4, 0.5, 0.58, 0.65, 0.72, 0.8]) {
    it(`computes margin for cost ratio ${costRatio}`, () => {
      const result = analyzePricingMargin({ totalRevenue: 20000, estimatedCostRatio: costRatio });
      expect(result.marginPercent).toBeGreaterThanOrEqual(0);
      expect(result.marginPercent).toBeLessThanOrEqual(100);
    });
  }
});

describe("Pricing intelligence discount scenarios", () => {
  for (const averageDiscount of [0, 8, 15, 22, 30, 40]) {
    it(`scores discount depth at ${averageDiscount}%`, () => {
      const result = analyzePricingDiscount({
        averageDiscountPercent: averageDiscount,
        discountFrequency: averageDiscount,
        discountedOrderCount: averageDiscount,
        totalOrders: 100,
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Pricing intelligence health score matrix", () => {
  for (const criticalIssueCount of [0, 1, 2, 4, 6, 8, 10, 12, 15, 18]) {
    it(`applies health penalty for ${criticalIssueCount} critical issues`, () => {
      const score = calculatePricingIntelligenceHealthScore({
        scores: buildMockPricingScores({ pricingHealthScore: 75 }),
        criticalIssueCount,
      });
      expect(score).toBeLessThanOrEqual(75);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  }
});

describe("Pricing intelligence category impact matrix", () => {
  for (const category of [
    "Margin Protection",
    "Discount Optimization",
    "Premium Pricing",
    "Inventory Pricing",
    "Bundle Pricing",
    "Psychological Pricing",
    "Price Consistency",
    "Revenue Optimization",
    "Conversion Pricing",
    "Markdown Timing",
    "Competitive Pricing",
    "Loss Leader Strategy",
  ] as const) {
    it(`estimates bounded impact for ${category}`, () => {
      const impact = estimatePricingImpact({
        category,
        confidence: 0.82,
        sectionScore: 48,
      });

      expect(impact).toBeDefined();
      if (["Revenue Optimization", "Conversion Pricing", "Bundle Pricing", "Premium Pricing"].includes(category)) {
        expect(impact.revenueIncrease).not.toBeNull();
      }
      if (["Margin Protection", "Discount Optimization", "Loss Leader Strategy"].includes(category)) {
        expect(impact.profitIncrease).not.toBeNull();
      }
    });
  }
});

describe("Pricing intelligence margin scenarios", () => {
  for (const costRatio of [0.4, 0.5, 0.58, 0.65, 0.72, 0.8]) {
    it(`computes margin for cost ratio ${costRatio}`, () => {
      const result = analyzePricingMargin({ totalRevenue: 20000, estimatedCostRatio: costRatio });
      expect(result.marginPercent).toBeGreaterThanOrEqual(0);
      expect(result.marginPercent).toBeLessThanOrEqual(100);
    });
  }
});

describe("Pricing intelligence discount scenarios", () => {
  for (const averageDiscount of [0, 8, 15, 22, 30, 40]) {
    it(`scores discount depth at ${averageDiscount}%`, () => {
      const result = analyzePricingDiscount({
        averageDiscountPercent: averageDiscount,
        discountFrequency: averageDiscount,
        discountedOrderCount: averageDiscount,
        totalOrders: 100,
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Pricing intelligence health score matrix", () => {
  for (const criticalIssueCount of [0, 1, 2, 4, 6, 8, 10, 12, 15, 18]) {
    it(`applies health penalty for ${criticalIssueCount} critical issues`, () => {
      const score = calculatePricingIntelligenceHealthScore({
        scores: buildMockPricingScores({ pricingHealthScore: 75 }),
        criticalIssueCount,
      });
      expect(score).toBeLessThanOrEqual(75);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  }
});
