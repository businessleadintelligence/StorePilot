import { describe, expect, it } from "vitest";

import { buildExecutiveCooEvidenceCatalog } from "../../agents/executive-coo-evidence";
import { estimateExecutiveCooPriorityImpact } from "../../agents/executive-coo-impact";
import { buildExecutiveDependencyGraph } from "../../tools/executive-dependency-tool";
import { calculateExecutiveConfidence } from "../../tools/executive-confidence-tool";
import { calculateOpportunityCost } from "../../tools/executive-opportunity-tool";
import { buildExecutivePlanningHorizons } from "../../tools/executive-timeline-tool";
import { buildExecutiveSummarySignals } from "../../tools/executive-summary-tool";
import { deriveExecutionOrder } from "../../tools/executive-execution-order-tool";
import { analyzeResourceLoad } from "../../tools/executive-resource-tool";
import { calculateExecutionReadiness } from "../../tools/executive-readiness-tool";
import { buildExecutiveCooFactsFromSnapshot, buildValidExecutiveCooDraft } from "./helpers";

describe("Executive COO additional tools", () => {
  it("builds agent evidence from specialist snapshots", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const catalog = buildExecutiveCooEvidenceCatalog(facts);
    expect(catalog.some((entry) => entry.key.startsWith("agent_"))).toBe(true);
  });

  it("estimates impact for revenue priorities", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const revenuePriority = draft.topPriorities.find((item) => item.focusArea === "Revenue");
    const impact = estimateExecutiveCooPriorityImpact(facts, revenuePriority!);
    expect(impact.revenueOpportunity ?? impact.revenueRecovered ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("builds collaboration dependency graph", () => {
    const graph = buildExecutiveDependencyGraph({
      nodes: [
        { id: "inventory:1", label: "Replenish", agentId: "inventory_intelligence", dependsOn: [] },
        { id: "growth:1", label: "Campaign", agentId: "growth_intelligence", dependsOn: ["inventory:1"] },
      ],
      collaborationDependencies: [
        {
          recommendationId: "growth:1",
          dependsOn: ["inventory:1"],
          reason: "inventory_prerequisite",
        },
      ],
    });

    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.rootCount).toBeGreaterThan(0);
  });

  it("calculates executive confidence with stale data penalty", () => {
    const fresh = calculateExecutiveConfidence({
      agentConfidences: [0.9, 0.88],
      dataFreshnessHours: [6, 12],
      evidenceCount: 6,
      conflictCount: 0,
      implementedActionCount: 2,
    });
    const stale = calculateExecutiveConfidence({
      agentConfidences: [0.9, 0.88],
      dataFreshnessHours: [96, 120],
      evidenceCount: 6,
      conflictCount: 2,
      implementedActionCount: 0,
    });

    expect(fresh.executiveConfidence).toBeGreaterThan(stale.executiveConfidence);
  });

  it("calculates opportunity cost from deferred impact", () => {
    const cost = calculateOpportunityCost({
      deferredRevenueImpact: 8000,
      deferredProfitImpact: 2500,
      blockedOperationCount: 3,
      conflictCount: 2,
      daysDelayed: 7,
    });

    expect(cost.estimatedRevenueCost).toBeGreaterThan(0);
    expect(cost.opportunityCostScore).toBeGreaterThan(0);
  });

  it("builds planning horizons from priority ids", () => {
    const horizons = buildExecutivePlanningHorizons({
      computedAt: "2026-06-20T08:00:00.000Z",
      topPriorityIds: ["a", "b", "c", "d"],
      weeklyFocusIds: ["a", "b", "c", "d", "e"],
      monthlyObjectiveIds: ["a", "b", "c", "d", "e", "f", "g"],
    });

    expect(horizons.dailyBriefing.length).toBeLessThanOrEqual(3);
    expect(horizons.weeklyPlan.length).toBeGreaterThan(0);
  });

  it("builds executive summary signals", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const signals = buildExecutiveSummarySignals({
      scores: {
        businessHealthScore: facts.operationsHealthScore,
        executiveHealthScore: facts.operationsHealthScore,
        businessMomentum: 68,
        growthMomentum: facts.growthScore,
        storeHealthScore: facts.storeHealthScore,
        agentHealthAverage: 72,
        executionPressure: 35,
        revenueGrowthRate: 4,
      },
      businessUrgency: 55,
      executiveConfidence: 0.84,
      topPriorityTitles: ["Replenish inventory", "Pricing recovery"],
      blockerCount: 1,
      opportunityCostScore: 42,
    });

    expect(signals.headline.length).toBeGreaterThan(0);
  });

  it("derives execution order from priority scores", () => {
    const order = deriveExecutionOrder({
      items: [
        { id: "a", priorityScore: 70, dependsOn: [], blockedBy: [], estimatedMinutes: 60 },
        { id: "b", priorityScore: 90, dependsOn: [], blockedBy: [], estimatedMinutes: 45 },
        { id: "c", priorityScore: 60, dependsOn: ["b"], blockedBy: [], estimatedMinutes: 90 },
      ],
    });

    expect(order.executionOrder[0]).toBe("b");
  });

  it("analyzes resource load across owners", () => {
    const load = analyzeResourceLoad({
      inProgressOperations: 4,
      pendingOperations: 6,
      activeAutomations: 2,
      merchantCapacityScore: 65,
      parallelWorkstreams: 3,
    });

    expect(load.resourceLoadScore).toBeGreaterThanOrEqual(0);
  });

  it("calculates execution readiness", () => {
    const readiness = calculateExecutionReadiness({
      merchantCapacityScore: 70,
      executionCapacityScore: 68,
      blockedOperationCount: 1,
      criticalBlockerCount: 0,
      executionRiskScore: 25,
    });

    expect(readiness.executionReadiness).toBeGreaterThan(0);
  });
});
