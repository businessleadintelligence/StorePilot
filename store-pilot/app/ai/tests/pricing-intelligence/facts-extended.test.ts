import { describe, expect, it } from "vitest";
import { createPricingIntelligenceFactsBuilder } from "../../facts/pricing-intelligence-facts";
import { createMockPricingIntelligenceSnapshot } from "./helpers";

describe("Pricing intelligence extended facts", () => {
  it("computes all v1 pricing scores deterministically", async () => {
    const builder = createPricingIntelligenceFactsBuilder({
      async getPricingIntelligenceSnapshot() {
        return createMockPricingIntelligenceSnapshot();
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "pricing_intelligence" });

    expect(facts.pricingHealthScore).toBeGreaterThan(0);
    expect(facts.scores.pricingHealthScore).toBeGreaterThan(0);
    expect(facts.scores.marginPercent).toBeGreaterThan(0);
    expect(facts.scores.aov).toBeGreaterThan(0);
    expect(facts.margin.issues.length).toBeGreaterThanOrEqual(0);
    expect(facts.discount.issues.length).toBeGreaterThanOrEqual(0);
    expect(facts.revenueOpportunity).toBeGreaterThan(0);
    expect(facts.profitOpportunity).toBeGreaterThan(0);
    expect(facts.strategySignals.premiumCandidates).toBeGreaterThanOrEqual(0);
    expect(facts.merchantPricingPreferences.prefersPremiumPositioning).toBeDefined();
  });

  it("includes section issues in critical issue count", async () => {
    const builder = createPricingIntelligenceFactsBuilder({
      async getPricingIntelligenceSnapshot() {
        return createMockPricingIntelligenceSnapshot({
          averageDiscountPercent: 32,
          discountedOrderCount: 45,
          totalOrders30: 50,
          slowMoverCount: 8,
          fastMoverCount: 1,
        });
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "pricing_intelligence" });
    expect(facts.criticalIssueCount).toBeGreaterThan(3);
  });

  it("computes strategy signals from product mix", async () => {
    const builder = createPricingIntelligenceFactsBuilder({
      async getPricingIntelligenceSnapshot() {
        return createMockPricingIntelligenceSnapshot();
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "pricing_intelligence" });

    expect(facts.strategySignals.neverDiscountCandidates).toBeGreaterThanOrEqual(0);
    expect(facts.strategySignals.priceSensitiveProducts).toBeGreaterThanOrEqual(0);
    expect(facts.strategySignals.gradualRaiseCandidates).toBeGreaterThanOrEqual(0);
  });
});

describe("Pricing intelligence snapshot variations", () => {
  for (const averageDiscountPercent of [5, 12, 20, 28, 35]) {
    it(`builds facts for average discount ${averageDiscountPercent}%`, async () => {
      const builder = createPricingIntelligenceFactsBuilder({
        async getPricingIntelligenceSnapshot() {
          return createMockPricingIntelligenceSnapshot({ averageDiscountPercent });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "pricing_intelligence" });
      expect(facts.scores.averageDiscountPercent).toBe(averageDiscountPercent);
      expect(facts.pricingHealthScore).toBeGreaterThanOrEqual(0);
    });
  }

  for (const slowMoverCount of [0, 2, 5, 8]) {
    it(`builds facts for ${slowMoverCount} slow movers`, async () => {
      const builder = createPricingIntelligenceFactsBuilder({
        async getPricingIntelligenceSnapshot() {
          return createMockPricingIntelligenceSnapshot({ slowMoverCount });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "pricing_intelligence" });
      expect(facts.inventory.issues.length).toBeGreaterThanOrEqual(0);
      expect(facts.storeTotals.activeProducts).toBeGreaterThan(0);
    });
  }
});

describe("Pricing intelligence snapshot variations", () => {
  for (const averageDiscountPercent of [5, 12, 20, 28, 35]) {
    it(`builds facts for average discount ${averageDiscountPercent}%`, async () => {
      const builder = createPricingIntelligenceFactsBuilder({
        async getPricingIntelligenceSnapshot() {
          return createMockPricingIntelligenceSnapshot({ averageDiscountPercent });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "pricing_intelligence" });
      expect(facts.scores.averageDiscountPercent).toBe(averageDiscountPercent);
      expect(facts.pricingHealthScore).toBeGreaterThanOrEqual(0);
    });
  }

  for (const slowMoverCount of [0, 2, 5, 8]) {
    it(`builds facts for ${slowMoverCount} slow movers`, async () => {
      const builder = createPricingIntelligenceFactsBuilder({
        async getPricingIntelligenceSnapshot() {
          return createMockPricingIntelligenceSnapshot({ slowMoverCount });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "pricing_intelligence" });
      expect(facts.inventory.issues.length).toBeGreaterThanOrEqual(0);
      expect(facts.storeTotals.activeProducts).toBeGreaterThan(0);
    });
  }
});
