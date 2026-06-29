import { describe, expect, it } from "vitest";

import { analyzePricingMargin } from "../../tools/pricing-margin-tool";
import { analyzePricingDiscount } from "../../tools/pricing-discount-tool";
import { calculatePricingIntelligenceHealthScore } from "../../tools/pricing-health-tool";
import { estimatePricingImpact } from "../../tools/pricing-impact-tool";
import { assignPricingRecommendationGroup } from "../../tools/pricing-group-tool";
import { calculatePricingPriorityScore } from "../../tools/pricing-ranking-tool";
import { dedupeSimilarPricingRecommendations } from "../../tools/pricing-similarity-tool";
import { analyzePricingRisk } from "../../tools/pricing-risk-tool";
import { createPricingIntelligenceFactsBuilder } from "../../facts/pricing-intelligence-facts";
import { buildPricingIntelligenceEvidenceCatalog } from "../../agents/pricing-intelligence-evidence";
import {
  buildMockPricingScores,
  buildPricingIntelligenceFactsFromSnapshot,
  createMockPricingIntelligenceSnapshot,
} from "./helpers";

describe("Pricing intelligence deterministic tools", () => {
  it("flags margin gaps from low margin percent", () => {
    const result = analyzePricingMargin({
      totalRevenue: 10000,
      estimatedCostRatio: 0.72,
    });

    expect(result.issues).toContain("margin_below_target");
    expect(result.marginPercent).toBeLessThan(40);
  });

  it("flags discount dependence from high frequency", () => {
    const result = analyzePricingDiscount({
      averageDiscountPercent: 24,
      discountFrequency: 55,
      discountedOrderCount: 55,
      totalOrders: 100,
    });

    expect(result.issues).toContain("discount_frequency_high");
    expect(result.score).toBeLessThan(80);
  });

  it("estimates pricing impact by category", () => {
    const impact = estimatePricingImpact({
      category: "Revenue Optimization",
      confidence: 0.8,
      sectionScore: 55,
    });

    expect(impact.revenueIncrease).toBeGreaterThan(0);
  });

  it("assigns recommendation groups", () => {
    expect(
      assignPricingRecommendationGroup({
        category: "Margin Protection",
        priorityScore: 75,
        hasDeterministicImpact: true,
      }),
    ).toBe("Critical Pricing Risks");
  });

  it("dedupes similar recommendations", () => {
    const deduped = dedupeSimilarPricingRecommendations([
      { category: "Discount Optimization", title: "Reduce blanket discounting", confidence: 0.7, priorityScore: 60 },
      { category: "Discount Optimization", title: "Reduce blanket discounting", confidence: 0.9, priorityScore: 80 },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.confidence).toBe(0.9);
  });

  it("builds facts from snapshot source", async () => {
    const snapshot = createMockPricingIntelligenceSnapshot();
    const builder = createPricingIntelligenceFactsBuilder({
      async getPricingIntelligenceSnapshot() {
        return snapshot;
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "pricing_intelligence" });

    expect(facts.pricingHealthScore).toBeGreaterThan(0);
    expect(facts.scores.pricingHealthScore).toBeGreaterThan(0);
    expect(facts.margin.marginPercent).toBeGreaterThan(0);
    expect(facts.discount.score).toBeGreaterThan(0);
  });

  it("builds evidence catalog from facts", async () => {
    const catalog = buildPricingIntelligenceEvidenceCatalog(await buildPricingIntelligenceFactsFromSnapshot());

    expect(catalog.some((entry) => entry.key === "pricing_health_score")).toBe(true);
    expect(catalog.some((entry) => entry.key === "margin_percent")).toBe(true);
  });

  it("calculates composite health score", () => {
    const score = calculatePricingIntelligenceHealthScore({
      scores: buildMockPricingScores({
        pricingHealthScore: 76,
        marginPercent: 38,
        discountDependence: 42,
      }),
      criticalIssueCount: 3,
    });

    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("audits pricing risk composite", () => {
    expect(
      analyzePricingRisk({
        revenueRisk: 40,
        profitRisk: 45,
        inventoryRisk: 35,
        discountDependence: 55,
      }).issues.length,
    ).toBeGreaterThan(0);
  });

  it("ranks pricing recommendations by priority score", () => {
    const high = calculatePricingPriorityScore({
      confidence: 0.95,
      difficultyWeight: 1,
      impact: { revenueIncrease: 8, profitIncrease: 5, marginImprovement: 0.05, roi: 0.1 },
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
});
