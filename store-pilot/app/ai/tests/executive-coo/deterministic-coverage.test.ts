import { describe, expect, it } from "vitest";

import { buildExecutiveCooFocusAreaGroups } from "../../agents/executive-coo-groups";
import { buildExecutiveCooHealthExplanation } from "../../agents/executive-coo-health";
import { estimateExecutiveCooPriorityImpact } from "../../agents/executive-coo-impact";
import { rankExecutiveCooTopPriorities } from "../../agents/executive-coo-ranking";
import { validateExecutiveCooEvidenceKeys, buildExecutiveCooEvidenceCatalog } from "../../agents/executive-coo-evidence";
import {
  EXECUTIVE_COO_DIFFICULTIES,
  EXECUTIVE_COO_FOCUS_AREAS,
  EXECUTIVE_COO_GROUPS,
} from "../../schemas/executive-coo";
import { analyzeMerchantCapacity, analyzeExecutionCapacity } from "../../tools/executive-capacity-tool";
import { calculateExecutivePriorityScore, deriveExecutivePriorityLevel } from "../../tools/executive-priority-tool";
import { calculateExecutiveConfidence } from "../../tools/executive-confidence-tool";
import { calculateOpportunityCost } from "../../tools/executive-opportunity-tool";
import { dedupeSimilarExecutiveCooRecommendations } from "../../tools/executive-similarity-tool";
import {
  buildExecutiveCooFactsFromSnapshot,
  buildMockExecutiveCooFacts,
  buildValidExecutiveCooDraft,
} from "./helpers";

describe("Executive COO deterministic coverage", () => {
  it("builds health explanation from facts", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const explanation = buildExecutiveCooHealthExplanation(facts);
    expect(explanation.score).toBe(facts.operationsHealthScore);
    expect(explanation.drivers.length).toBeGreaterThan(0);
  });

  it("groups priorities into focus area buckets", () => {
    const groups = buildExecutiveCooFocusAreaGroups([
      { id: "executive-coo:inventory", group: "Inventory Stabilization" },
      { id: "executive-coo:revenue", group: "Revenue Recovery" },
    ]);

    expect(groups.inventoryStabilization).toContain("executive-coo:inventory");
    expect(groups.revenueRecovery).toContain("executive-coo:revenue");
  });

  it("ranks priorities and estimates impact", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const impacts = new Map(
      draft.topPriorities.map((priority) => [
        priority.id,
        estimateExecutiveCooPriorityImpact(facts, priority),
      ]),
    );

    const ranked = rankExecutiveCooTopPriorities({
      facts,
      priorities: draft.topPriorities,
      impacts,
    });

    expect(ranked[0]?.priorityScore).toBeGreaterThan(0);
    expect(impacts.get(draft.topPriorities[0]?.id ?? "")?.revenueOpportunity ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("validates evidence keys against catalog", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const catalog = buildExecutiveCooEvidenceCatalog(facts);
    expect(() =>
      validateExecutiveCooEvidenceKeys(["operations_health_score", "inventory_risk"], catalog),
    ).not.toThrow();
  });
});

describe("Executive COO health score matrix", () => {
  for (const criticalIssueCount of [0, 1, 2, 4, 6, 8, 10, 12, 15, 18]) {
    it(`builds explanation for ${criticalIssueCount} critical issues`, () => {
      const facts = buildMockExecutiveCooFacts({ criticalIssueCount });
      const explanation = buildExecutiveCooHealthExplanation(facts);
      expect(explanation.score).toBe(facts.operationsHealthScore);
      expect(explanation.summary.length).toBeGreaterThan(0);
    });
  }
});

describe("Executive COO focus area impact matrix", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`estimates bounded impact for ${focusArea}`, async () => {
      const facts = await buildExecutiveCooFactsFromSnapshot();
      const impact = estimateExecutiveCooPriorityImpact(facts, {
        id: `executive-coo:${focusArea.toLowerCase()}`,
        focusArea,
        title: `${focusArea} priority`,
        reason: "Test priority",
        supportingAgents: ["inventory_intelligence"],
        sourceRecommendationIds: ["inventory:stockout-plan"],
        evidenceKeys: ["operations_health_score"],
        merchantAction: ["Act"],
        expectedResult: "Improve operations",
        estimatedImpact: "Measurable improvement",
        difficulty: "Medium",
        priority: 2,
        confidence: 0.8,
        verificationCriteria: "Metric improves",
        timeline: "2 weeks",
        executionOrder: 1,
        dependsOn: [],
      });

      expect(impact).toBeDefined();
    });
  }
});

describe("Executive COO merchant capacity scenarios", () => {
  for (const openOperations of [0, 2, 4, 6, 8, 10]) {
    it(`scores merchant capacity with ${openOperations} open operations`, () => {
      const result = analyzeMerchantCapacity({
        openOperations,
        inProgressOperations: 1,
        openRecommendations: 5,
        openAutomations: 2,
        averageCompletionMinutes: 45,
        preferredBatchSize: 4,
      });

      expect(result.merchantCapacityScore).toBeGreaterThanOrEqual(0);
      expect(result.merchantCapacityScore).toBeLessThanOrEqual(100);
      expect(["low", "medium", "high"]).toContain(result.overloadRisk);
    });
  }
});

describe("Executive COO priority score matrix", () => {
  for (const confidence of [0.4, 0.55, 0.7, 0.85, 0.95]) {
    it(`scores priority at confidence ${confidence}`, () => {
      const score = calculateExecutivePriorityScore({
        confidence,
        difficulty: "Medium",
        revenueImpact: 40,
        profitImpact: 20,
        urgencySignals: 3,
        blocked: false,
        dismissed: false,
        agentWeight: 1,
      });

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(deriveExecutivePriorityLevel(score)).toBeGreaterThanOrEqual(1);
    });
  }
});

describe("Executive COO schema group coverage", () => {
  for (const group of EXECUTIVE_COO_GROUPS) {
    it(`supports group ${group}`, () => {
      expect(group.length).toBeGreaterThan(2);
    });
  }

  for (const difficulty of EXECUTIVE_COO_DIFFICULTIES) {
    it(`supports difficulty ${difficulty}`, () => {
      const score = calculateExecutivePriorityScore({
        confidence: 0.8,
        difficulty,
        revenueImpact: 30,
        profitImpact: 15,
        urgencySignals: 2,
        blocked: false,
        dismissed: false,
        agentWeight: 1,
      });
      expect(score).toBeGreaterThan(0);
    });
  }
});

describe("Executive COO operational tool coverage", () => {
  const toolCases = [
    {
      name: "execution capacity healthy",
      run: () =>
        analyzeExecutionCapacity({
          merchantCapacityScore: 75,
          blockedOperationCount: 0,
          automationReadyCount: 3,
          teamOwnerCount: 2,
        }),
      assert: (result: ReturnType<typeof analyzeExecutionCapacity>) =>
        expect(result.executionCapacityScore).toBeGreaterThan(40),
    },
    {
      name: "executive confidence strong",
      run: () =>
        calculateExecutiveConfidence({
          agentConfidences: [0.88, 0.9, 0.86],
          dataFreshnessHours: [12, 24, 18],
          evidenceCount: 8,
          conflictCount: 0,
          implementedActionCount: 3,
        }),
      assert: (result: ReturnType<typeof calculateExecutiveConfidence>) =>
        expect(result.executiveConfidence).toBeGreaterThan(0.6),
    },
    {
      name: "opportunity cost elevated",
      run: () =>
        calculateOpportunityCost({
          deferredRevenueImpact: 12000,
          deferredProfitImpact: 4500,
          blockedOperationCount: 2,
          conflictCount: 1,
          daysDelayed: 5,
        }),
      assert: (result: ReturnType<typeof calculateOpportunityCost>) =>
        expect(result.opportunityCostScore).toBeGreaterThan(0),
    },
  ] as const;

  for (const testCase of toolCases) {
    it(`covers ${testCase.name}`, () => {
      const result = testCase.run();
      testCase.assert(result as never);
    });
  }

  it("dedupes similar executive priorities by category and title", () => {
    const deduped = dedupeSimilarExecutiveCooRecommendations([
      { category: "Inventory", title: "Replenish hero SKU", confidence: 0.7 },
      { category: "Inventory", title: "Replenish hero SKU", confidence: 0.9 },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.confidence).toBe(0.9);
  });
});
