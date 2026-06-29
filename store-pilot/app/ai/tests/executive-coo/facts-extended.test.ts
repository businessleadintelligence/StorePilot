import { describe, expect, it } from "vitest";

import { createExecutiveCooFactsBuilder } from "../../facts/executive-coo-facts";
import { createMockExecutiveCooSnapshot } from "./helpers";

describe("Executive COO extended facts", () => {
  it("computes operations health and strategy signals deterministically", async () => {
    const builder = createExecutiveCooFactsBuilder({
      async getExecutiveCooSnapshot() {
        return createMockExecutiveCooSnapshot();
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "executive_coo" });

    expect(facts.operationsHealthScore).toBeGreaterThan(0);
    expect(facts.revenueOpportunity).toBeGreaterThan(0);
    expect(facts.strategySignals.openSpecialistRecommendations).toBeGreaterThan(0);
    expect(facts.merchantOperationalPreferences.prefersInventoryFirst).toBeDefined();
  });

  it("includes critical issues from agent snapshots", async () => {
    const builder = createExecutiveCooFactsBuilder({
      async getExecutiveCooSnapshot() {
        return createMockExecutiveCooSnapshot({
          agentSnapshots: createMockExecutiveCooSnapshot().agentSnapshots.map((snapshot, index) => ({
            ...snapshot,
            riskScore: index === 0 ? 80 : snapshot.riskScore,
            healthScore: index === 0 ? 40 : snapshot.healthScore,
          })),
        });
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "executive_coo" });
    expect(facts.criticalIssueCount).toBeGreaterThan(0);
  });

  it("computes strategy signals from specialist recommendations", async () => {
    const builder = createExecutiveCooFactsBuilder({
      async getExecutiveCooSnapshot() {
        return createMockExecutiveCooSnapshot();
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "executive_coo" });

    expect(facts.strategySignals.revenueRecoveryCandidates).toBeGreaterThanOrEqual(0);
    expect(facts.strategySignals.growthAccelerationCandidates).toBeGreaterThanOrEqual(0);
    expect(facts.strategySignals.immediateWinCount).toBeGreaterThanOrEqual(0);
  });
});

describe("Executive COO snapshot variations", () => {
  for (const inventoryRisk of [20, 40, 60, 80]) {
    it(`builds facts for inventory risk ${inventoryRisk}`, async () => {
      const builder = createExecutiveCooFactsBuilder({
        async getExecutiveCooSnapshot() {
          return createMockExecutiveCooSnapshot({
            storeMetrics: {
              storeHealthScore: 74,
              revenueOpportunity: 18200,
              inventoryRisk,
              growthScore: 68,
            },
          });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "executive_coo" });
      expect(facts.inventoryRisk).toBe(inventoryRisk);
      expect(facts.operationsHealthScore).toBeGreaterThanOrEqual(0);
    });
  }

  for (const revenueOpportunity of [5000, 10000, 15000, 20000, 25000, 30000]) {
    it(`builds facts for revenue opportunity ${revenueOpportunity}`, async () => {
      const builder = createExecutiveCooFactsBuilder({
        async getExecutiveCooSnapshot() {
          return createMockExecutiveCooSnapshot({
            storeMetrics: {
              storeHealthScore: 74,
              revenueOpportunity,
              inventoryRisk: 42,
              growthScore: 68,
            },
          });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "executive_coo" });
      expect(facts.revenueOpportunity).toBe(revenueOpportunity);
    });
  }

  for (const growthScore of [45, 55, 65, 75, 85]) {
    it(`builds facts for growth score ${growthScore}`, async () => {
      const builder = createExecutiveCooFactsBuilder({
        async getExecutiveCooSnapshot() {
          return createMockExecutiveCooSnapshot({
            storeMetrics: {
              storeHealthScore: 74,
              revenueOpportunity: 18200,
              inventoryRisk: 42,
              growthScore,
            },
          });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "executive_coo" });
      expect(facts.growthScore).toBe(growthScore);
    });
  }

  for (const storeHealthScore of [50, 60, 70, 80, 90]) {
    it(`builds facts for store health score ${storeHealthScore}`, async () => {
      const builder = createExecutiveCooFactsBuilder({
        async getExecutiveCooSnapshot() {
          return createMockExecutiveCooSnapshot({
            storeHealthScore,
            storeMetrics: {
              storeHealthScore,
              revenueOpportunity: 18200,
              inventoryRisk: 42,
              growthScore: 68,
            },
          });
        },
      });

      const facts = await builder.build({ storeId: "store-1", agentId: "executive_coo" });
      expect(facts.storeHealthScore).toBe(storeHealthScore);
    });
  }
});
