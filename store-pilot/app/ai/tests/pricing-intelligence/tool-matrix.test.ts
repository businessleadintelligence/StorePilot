import { describe, expect, it } from "vitest";

import { buildMockPricingScores } from "./helpers";
import { PRICING_INTELLIGENCE_GROUPS, PRICING_INTELLIGENCE_CATEGORIES } from "../../schemas/pricing-intelligence";
import { analyzePricingMargin } from "../../tools/pricing-margin-tool";
import { analyzePricingDiscount } from "../../tools/pricing-discount-tool";
import { calculatePricingIntelligenceHealthScore } from "../../tools/pricing-health-tool";
import { estimatePricingImpact } from "../../tools/pricing-impact-tool";
import { assignPricingRecommendationGroup } from "../../tools/pricing-group-tool";
import { arePricingRecommendationsSimilar } from "../../tools/pricing-similarity-tool";
import { buildPricingIntelligenceEvidenceCatalog } from "../../agents/pricing-intelligence-evidence";
import { buildPricingIntelligenceFactsFromSnapshot } from "./helpers";

describe("Pricing intelligence tool matrix", () => {
  for (const category of PRICING_INTELLIGENCE_CATEGORIES) {
    it(`supports category ${category}`, () => {
      expect(category.length).toBeGreaterThan(2);
    });
  }

  for (const group of PRICING_INTELLIGENCE_GROUPS) {
    it(`supports group ${group}`, () => {
      expect(group.length).toBeGreaterThan(2);
    });
  }

  it("scores weak margin lower than strong margin", () => {
    const weak = analyzePricingMargin({ totalRevenue: 10000, estimatedCostRatio: 0.75 });
    const strong = analyzePricingMargin({ totalRevenue: 10000, estimatedCostRatio: 0.45 });

    expect(weak.marginPercent).toBeLessThan(strong.marginPercent);
  });

  it("scores high discount frequency lower", () => {
    const heavy = analyzePricingDiscount({
      averageDiscountPercent: 28,
      discountFrequency: 70,
      discountedOrderCount: 70,
      totalOrders: 100,
    });
    const light = analyzePricingDiscount({
      averageDiscountPercent: 5,
      discountFrequency: 10,
      discountedOrderCount: 10,
      totalOrders: 100,
    });

    expect(heavy.score).toBeLessThan(light.score);
  });

  it("calculates health score penalties for critical issues", () => {
    const lowIssues = calculatePricingIntelligenceHealthScore({
      scores: buildMockPricingScores({ pricingHealthScore: 80 }),
      criticalIssueCount: 0,
    });
    const highIssues = calculatePricingIntelligenceHealthScore({
      scores: buildMockPricingScores({ pricingHealthScore: 80 }),
      criticalIssueCount: 8,
    });

    expect(highIssues).toBeLessThan(lowIssues);
  });

  it("estimates revenue impact for premium pricing", () => {
    const impact = estimatePricingImpact({
      category: "Premium Pricing",
      confidence: 0.85,
      sectionScore: 50,
    });

    expect(impact.revenueIncrease).toBeGreaterThan(0);
  });

  it("assigns premium pricing group", () => {
    expect(
      assignPricingRecommendationGroup({
        category: "Premium Pricing",
        priorityScore: 50,
        hasDeterministicImpact: false,
      }),
    ).toBe("Premium Pricing");
  });

  it("detects similar pricing recommendations", () => {
    expect(
      arePricingRecommendationsSimilar(
        { category: "Discount Optimization", title: "Reduce blanket discounting" },
        { category: "Discount Optimization", title: "Reduce blanket discounting" },
      ),
    ).toBe(true);
  });

  it("builds evidence catalog with pricing keys", async () => {
    const catalog = buildPricingIntelligenceEvidenceCatalog(await buildPricingIntelligenceFactsFromSnapshot());

    expect(catalog.some((entry) => entry.key === "revenue_opportunity")).toBe(true);
    expect(catalog.some((entry) => entry.key === "profit_opportunity")).toBe(true);
  });
});
