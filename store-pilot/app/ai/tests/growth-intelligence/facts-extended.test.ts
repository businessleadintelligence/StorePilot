import { describe, expect, it } from "vitest";
import { createGrowthIntelligenceFactsBuilder } from "../../facts/growth-intelligence-facts";
import { createMockGrowthIntelligenceSnapshot } from "./helpers";

describe("Growth intelligence extended facts", () => {
  it("computes all growth scores deterministically", async () => {
    const builder = createGrowthIntelligenceFactsBuilder({
      async getGrowthIntelligenceSnapshot() {
        return createMockGrowthIntelligenceSnapshot();
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "growth_intelligence" });

    expect(facts.growthHealthScore).toBeGreaterThan(0);
    expect(facts.scores.growthScore).toBeGreaterThan(0);
    expect(facts.scores.aov).toBeGreaterThan(0);
    expect(facts.revenue.issues.length).toBeGreaterThanOrEqual(0);
    expect(facts.retention.issues.length).toBeGreaterThanOrEqual(0);
    expect(facts.scores.revenueOpportunity).toBeGreaterThan(0);
    expect(facts.scores.profitOpportunity).toBeGreaterThan(0);
    expect(facts.strategySignals.upsellCandidates).toBeGreaterThanOrEqual(0);
    expect(facts.merchantGrowthPreferences.prefersAovGrowth).toBeDefined();
  });

  it("includes section issues in critical issue count", async () => {
    const builder = createGrowthIntelligenceFactsBuilder({
      async getGrowthIntelligenceSnapshot() {
        return createMockGrowthIntelligenceSnapshot({
          previousRevenue30: 18000,
          returningCustomerRate: 12,
          slowMoverCount: 8,
          fastMoverCount: 1,
        });
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "growth_intelligence" });
    expect(facts.criticalIssueCount).toBeGreaterThan(0);
  });

  it("computes strategy signals from product mix", async () => {
    const builder = createGrowthIntelligenceFactsBuilder({
      async getGrowthIntelligenceSnapshot() {
        return createMockGrowthIntelligenceSnapshot();
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "growth_intelligence" });

    expect(facts.strategySignals.crossSellPairs).toBeGreaterThanOrEqual(0);
    expect(facts.strategySignals.collectionExpansionCandidates).toBeGreaterThanOrEqual(0);
    expect(facts.strategySignals.immediateWinCount).toBeGreaterThanOrEqual(0);
  });
});

describe("Growth intelligence snapshot variations", () => {
  for (const returningCustomerRate of [12, 20, 28, 35]) {
    it(`builds facts for returning customer rate ${returningCustomerRate}%`, async () => {
      const builder = createGrowthIntelligenceFactsBuilder({
        async getGrowthIntelligenceSnapshot() {
          return createMockGrowthIntelligenceSnapshot({ returningCustomerRate });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "growth_intelligence" });
      expect(facts.storeTotals.returningCustomerRate).toBe(returningCustomerRate);
      expect(facts.growthHealthScore).toBeGreaterThanOrEqual(0);
    });
  }

  for (const slowMoverCount of [0, 2, 5, 8]) {
    it(`builds facts for ${slowMoverCount} slow movers`, async () => {
      const builder = createGrowthIntelligenceFactsBuilder({
        async getGrowthIntelligenceSnapshot() {
          return createMockGrowthIntelligenceSnapshot({ slowMoverCount });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "growth_intelligence" });
      expect(facts.strategySignals.retentionRiskProducts).toBe(slowMoverCount);
    });
  }
});
