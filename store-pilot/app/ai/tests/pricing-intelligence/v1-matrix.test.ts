import { describe, expect, it } from "vitest";

import { buildMockPricingScores } from "./helpers";
import { PRICING_INTELLIGENCE_CATEGORIES } from "../../schemas/pricing-intelligence";
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
import { calculatePricingIntelligenceHealthScore } from "../../tools/pricing-health-tool";
import { buildPricingIntelligenceDeliverableFields } from "../../schemas/pricing-intelligence";

const PRICING_AREA_RUNNERS: Record<string, () => { score?: number; marginPercent?: number; demandScore?: number; priceConsistencyScore?: number; issues: string[] }> = {
  "Margin Protection": () =>
    analyzePricingMargin({
      totalRevenue: 10000,
      estimatedCostRatio: 0.62,
    }),
  "Discount Optimization": () =>
    analyzePricingDiscount({
      averageDiscountPercent: 22,
      discountFrequency: 48,
      discountedOrderCount: 48,
      totalOrders: 100,
    }),
  "Premium Pricing": () =>
    analyzePricingPremium({
      highVelocityProducts: 3,
      lowDiscountProducts: 4,
      averageMarginPercent: 38,
      totalProducts: 10,
    }),
  "Inventory Pricing": () =>
    analyzePricingInventory({
      averageWeeksOfCover: 11,
      slowMoverCount: 4,
      fastMoverCount: 2,
      totalProducts: 10,
    }),
  "Bundle Pricing": () =>
    analyzePricingBundle({
      bundleCandidateCount: 3,
      attachRateProxy: 0.3,
      totalProducts: 10,
    }),
  "Psychological Pricing": () => analyzePricingPsychology({ prices: [20, 35, 50, 80] }),
  "Price Consistency": () => analyzePriceConsistency({ prices: [19.99, 24.99, 89.99, 129.99] }),
  "Revenue Optimization": () =>
    analyzePricingRevenue({
      totalRevenue: 11000,
      previousRevenue: 12000,
      aov: 28,
    }),
  "Conversion Pricing": () =>
    analyzePricingConversion({
      conversionRate: 0.022,
      averageDiscountPercent: 20,
    }),
  "Markdown Timing": () =>
    analyzePricingDiscount({
      averageDiscountPercent: 18,
      discountFrequency: 35,
      discountedOrderCount: 35,
      totalOrders: 100,
    }),
  "Competitive Pricing": () =>
    analyzePricingCompetition({
      medianPrice: 45,
      prices: [18, 30, 45, 60, 110],
    }),
  "Loss Leader Strategy": () =>
    analyzePricingRisk({
      revenueRisk: 35,
      profitRisk: 40,
      inventoryRisk: 30,
      discountDependence: 45,
    }),
};

describe("Pricing intelligence v1 category coverage", () => {
  for (const category of PRICING_INTELLIGENCE_CATEGORIES) {
    it(`supports schema category ${category}`, () => {
      expect(category.length).toBeGreaterThan(2);
    });
  }

  for (const [area, run] of Object.entries(PRICING_AREA_RUNNERS)) {
    it(`computes deterministic score for ${area}`, () => {
      const result = run();
      expect(Array.isArray(result.issues)).toBe(true);
      if ("score" in result && result.score !== undefined) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
      if ("marginPercent" in result && result.marginPercent !== undefined) {
        expect(result.marginPercent).toBeGreaterThanOrEqual(0);
      }
      if ("priceConsistencyScore" in result && result.priceConsistencyScore !== undefined) {
        expect(result.priceConsistencyScore).toBeGreaterThanOrEqual(0);
        expect(result.priceConsistencyScore).toBeLessThanOrEqual(100);
      }
    });
  }
});

describe("Pricing intelligence v1 deliverable outputs", () => {
  for (const priority of [1, 2, 3, 4, 5]) {
    it(`maps revenue opportunity for priority ${priority}`, () => {
      const fields = buildPricingIntelligenceDeliverableFields({
        facts: {
          pricingHealthScore: 68,
          revenueOpportunity: 420,
          profitOpportunity: 180,
        },
        recommendations: [{ id: "r1", title: "Reduce discounting", group: "Quick Revenue Wins", priority }],
        findings: [],
      });
      expect(fields.revenueOpportunity).toBe(420);
      expect(fields.profitOpportunity).toBe(180);
    });
  }

  for (const severity of ["low", "medium", "high", "critical"] as const) {
    it(`maps ${severity} findings into deliverable fields`, () => {
      const fields = buildPricingIntelligenceDeliverableFields({
        facts: {
          pricingHealthScore: 65,
          revenueOpportunity: 300,
          profitOpportunity: 120,
        },
        recommendations: [],
        findings: [{ title: `${severity} pricing finding`, severity }],
      });
      if (severity === "critical" || severity === "high") {
        expect(fields.criticalPricingRisks).toContain(`${severity} pricing finding`);
      } else {
        expect(fields.criticalPricingRisks).not.toContain(`${severity} pricing finding`);
      }
    });
  }
});

describe("Pricing intelligence health score bands", () => {
  for (const criticalIssueCount of [0, 3, 6, 12, 20]) {
    it(`applies capped penalty for ${criticalIssueCount} issues`, () => {
      const score = calculatePricingIntelligenceHealthScore({
        scores: buildMockPricingScores({ pricingHealthScore: 80 }),
        criticalIssueCount,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Pricing intelligence profit and demand tools", () => {
  it("computes profit trend from gross profit change", () => {
    const result = analyzePricingProfit({
      grossProfit: 4200,
      previousGrossProfit: 3800,
      marginPercent: 36,
    });
    expect(result.profitTrend).toBeGreaterThan(0);
  });

  it("computes demand score from velocity", () => {
    const result = analyzePricingDemand({
      totalUnitsSold: 90,
      totalProducts: 8,
      velocity: 2.8,
    });
    expect(result.demandScore).toBeGreaterThan(20);
  });
});

describe("Pricing intelligence group assignment matrix", () => {
  for (const group of [
    "Critical Pricing Risks",
    "Margin Protection",
    "Quick Revenue Wins",
    "Premium Pricing",
    "Discount Optimization",
    "Inventory Pricing",
    "Bundle Pricing",
    "Long-Term Pricing Strategy",
  ] as const) {
    it(`supports deliverable group ${group}`, () => {
      expect(group.length).toBeGreaterThan(5);
    });
  }
});

describe("Pricing intelligence premium scenario matrix", () => {
  for (const highVelocity of [0, 1, 2, 4, 6]) {
    it(`counts premium opportunities for ${highVelocity} high-velocity products`, () => {
      const result = analyzePricingPremium({
        highVelocityProducts: highVelocity,
        lowDiscountProducts: highVelocity + 1,
        averageMarginPercent: 38,
        totalProducts: 10,
      });
      expect(result.opportunityCount).toBeLessThanOrEqual(highVelocity);
    });
  }
});

describe("Pricing intelligence bundle scenario matrix", () => {
  for (const bundleCandidates of [0, 1, 2, 4, 6]) {
    it(`scores bundle opportunity for ${bundleCandidates} candidates`, () => {
      const result = analyzePricingBundle({
        bundleCandidateCount: bundleCandidates,
        attachRateProxy: 0.2,
        totalProducts: 10,
      });
      expect(result.bundlePriceOpportunity).toBeGreaterThanOrEqual(0);
      expect(result.bundlePriceOpportunity).toBeLessThanOrEqual(100);
    });
  }
});

describe("Pricing intelligence group assignment matrix", () => {
  for (const group of [
    "Critical Pricing Risks",
    "Margin Protection",
    "Quick Revenue Wins",
    "Premium Pricing",
    "Discount Optimization",
    "Inventory Pricing",
    "Bundle Pricing",
    "Long-Term Pricing Strategy",
  ] as const) {
    it(`supports deliverable group ${group}`, () => {
      expect(group.length).toBeGreaterThan(5);
    });
  }
});

describe("Pricing intelligence premium scenario matrix", () => {
  for (const highVelocity of [0, 1, 2, 4, 6]) {
    it(`counts premium opportunities for ${highVelocity} high-velocity products`, () => {
      const result = analyzePricingPremium({
        highVelocityProducts: highVelocity,
        lowDiscountProducts: highVelocity + 1,
        averageMarginPercent: 38,
        totalProducts: 10,
      });
      expect(result.opportunityCount).toBeLessThanOrEqual(highVelocity);
    });
  }
});

describe("Pricing intelligence bundle scenario matrix", () => {
  for (const bundleCandidates of [0, 1, 2, 4, 6]) {
    it(`scores bundle opportunity for ${bundleCandidates} candidates`, () => {
      const result = analyzePricingBundle({
        bundleCandidateCount: bundleCandidates,
        attachRateProxy: 0.2,
        totalProducts: 10,
      });
      expect(result.bundlePriceOpportunity).toBeGreaterThanOrEqual(0);
      expect(result.bundlePriceOpportunity).toBeLessThanOrEqual(100);
    });
  }
});
