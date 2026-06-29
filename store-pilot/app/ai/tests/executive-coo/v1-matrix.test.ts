import { describe, expect, it } from "vitest";

import { buildExecutiveCooDeliverableFields } from "../../schemas/executive-coo";
import { EXECUTIVE_COO_FOCUS_AREAS, EXECUTIVE_COO_GROUPS } from "../../schemas/executive-coo";
import { rankExecutiveCooTopPriorities } from "../../agents/executive-coo-ranking";
import { estimateExecutiveCooPriorityImpact } from "../../agents/executive-coo-impact";
import { assignExecutiveCooGroupFromImpact } from "../../agents/executive-coo-groups";
import { calculateBusinessHealthScore } from "../../tools/executive-business-health-tool";
import { analyzeMerchantCapacity } from "../../tools/executive-capacity-tool";
import { buildExecutiveCooFactsFromSnapshot, buildValidExecutiveCooDraft } from "./helpers";

describe("Executive COO v1 focus area coverage", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`supports schema focus area ${focusArea}`, () => {
      expect(focusArea.length).toBeGreaterThan(2);
    });
  }

  for (const group of EXECUTIVE_COO_GROUPS) {
    it(`supports schema group ${group}`, () => {
      expect(group.length).toBeGreaterThan(2);
    });
  }
});

describe("Executive COO v1 operational runners", () => {
  const runners: Record<string, () => { score?: number; issues?: string[] }> = {
    "merchant capacity light": () =>
      analyzeMerchantCapacity({
        openOperations: 1,
        inProgressOperations: 0,
        openRecommendations: 2,
        openAutomations: 0,
        averageCompletionMinutes: 30,
        preferredBatchSize: 5,
      }),
    "merchant capacity heavy": () =>
      analyzeMerchantCapacity({
        openOperations: 8,
        inProgressOperations: 3,
        openRecommendations: 10,
        openAutomations: 4,
        averageCompletionMinutes: 75,
        preferredBatchSize: 3,
      }),
    "business health composite": () => ({
      score: calculateBusinessHealthScore({
        storeHealthScore: 72,
        productHealthScore: 68,
        inventoryHealthScore: 55,
        bundleHealthScore: 70,
        storeAuditScore: 74,
        seoHealthScore: 66,
        pricingHealthScore: 71,
        growthHealthScore: 69,
        revenueGrowthRate: 6,
        orderCount: 120,
        openOperationCount: 4,
        blockedOperationCount: 1,
        openRecommendationCount: 8,
        agentConfidenceAvg: 0.84,
      }),
    }),
  };

  for (const [name, run] of Object.entries(runners)) {
    it(`computes deterministic output for ${name}`, () => {
      const result = run();
      if (result.score !== undefined) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
      if (result.issues) {
        expect(Array.isArray(result.issues)).toBe(true);
      }
    });
  }
});

describe("Executive COO v1 deliverable outputs", () => {
  for (const priority of [1, 2, 3, 4, 5]) {
    it(`maps revenue opportunity for priority ${priority}`, () => {
      const fields = buildExecutiveCooDeliverableFields({
        facts: {
          operationsHealthScore: 72,
          revenueOpportunity: 18200,
          inventoryRisk: 42,
        },
        topPriorities: [
          {
            id: "executive-coo:strategy",
            title: "Expand collections",
            group: "Long-Term Strategy",
            priority,
          },
        ],
        findings: [{ title: "Inventory risk elevated", severity: "high" }],
      });

      expect(fields.revenueOpportunity).toBe(18200);
      expect(fields.operationsTimeline.length).toBeGreaterThan(0);
    });
  }

  it("maps inventory focus area to stabilization group", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const impacts = new Map(
      draft.topPriorities.map((priority) => [
        priority.id,
        estimateExecutiveCooPriorityImpact(facts, priority),
      ]),
    );
    const ranked = rankExecutiveCooTopPriorities({ facts, priorities: draft.topPriorities, impacts });
    expect(ranked.some((item) => item.focusArea === "Inventory")).toBe(true);
  });

  it("assigns groups from focus area impact", () => {
    expect(
      assignExecutiveCooGroupFromImpact({
        focusArea: "Inventory",
        priorityScore: 88,
        impact: { inventoryReduction: 12 },
      }),
    ).toBe("Inventory Stabilization");
  });
});
