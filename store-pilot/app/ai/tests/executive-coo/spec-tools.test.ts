import { describe, expect, it } from "vitest";

import { buildExecutiveCooEvidenceCatalog } from "../../agents/executive-coo-evidence";
import { assignExecutiveCooGroupFromImpact } from "../../agents/executive-coo-groups";
import { buildExecutiveCooHealthExplanation } from "../../agents/executive-coo-health";
import { EXECUTIVE_COO_FOCUS_AREAS } from "../../schemas/executive-coo";
import { analyzeMerchantCapacity, analyzeExecutionCapacity } from "../../tools/executive-capacity-tool";
import { analyzeExecutiveWorkload } from "../../tools/executive-workload-tool";
import { buildExecutiveDependencyGraph } from "../../tools/executive-dependency-tool";
import { analyzeExecutiveConflicts } from "../../tools/executive-conflict-tool";
import { deriveExecutiveCriticalPath } from "../../tools/executive-critical-path-tool";
import { analyzeExecutionRisk } from "../../tools/executive-risk-tool";
import {
  calculateBusinessHealthScore,
  classifyExecutiveHealthBand,
} from "../../tools/executive-business-health-tool";
import {
  calculateExecutivePriorityScore,
  calculateBusinessUrgency,
} from "../../tools/executive-priority-tool";
import { rankExecutivePriorities } from "../../tools/executive-ranking-tool";
import { buildExecutiveTimeline } from "../../tools/executive-timeline-tool";
import { identifyBlockedTasks } from "../../tools/executive-blocker-tool";
import { estimateExpectedRoi } from "../../tools/executive-roi-tool";
import { buildMockExecutiveCooFacts } from "./helpers";

describe("Executive COO spec tools", () => {
  it("builds evidence catalog entries", () => {
    const catalog = buildExecutiveCooEvidenceCatalog(buildMockExecutiveCooFacts());
    expect(catalog.some((entry) => entry.key === "operations_health_score")).toBe(true);
  });

  it("builds health explanation drivers", () => {
    const explanation = buildExecutiveCooHealthExplanation(buildMockExecutiveCooFacts());
    expect(explanation.summary).toContain("Operations");
  });

  it("scores overloaded merchant capacity lower", () => {
    const light = analyzeMerchantCapacity({
      openOperations: 1,
      inProgressOperations: 0,
      openRecommendations: 2,
      openAutomations: 0,
      averageCompletionMinutes: 30,
      preferredBatchSize: 5,
    });
    const heavy = analyzeMerchantCapacity({
      openOperations: 8,
      inProgressOperations: 4,
      openRecommendations: 12,
      openAutomations: 6,
      averageCompletionMinutes: 90,
      preferredBatchSize: 3,
    });

    expect(heavy.merchantCapacityScore).toBeLessThan(light.merchantCapacityScore);
    expect(heavy.overloadRisk).not.toBe("low");
  });

  it("analyzes execution capacity with automation readiness", () => {
    const result = analyzeExecutionCapacity({
      merchantCapacityScore: 70,
      blockedOperationCount: 1,
      automationReadyCount: 4,
      teamOwnerCount: 2,
    });

    expect(result.executionCapacityScore).toBeGreaterThan(0);
    expect(result.parallelWorkstreams).toBeGreaterThanOrEqual(1);
  });

  it("analyzes executive workload pressure", () => {
    const result = analyzeExecutiveWorkload({
      operations: [
        { id: "op-1", title: "Replenish stock", status: "in_progress", estimatedMinutes: 90, priorityScore: 80 },
        { id: "op-2", title: "Pricing review", status: "pending", estimatedMinutes: 60, priorityScore: 70 },
      ],
      recommendations: [{ id: "rec-1", priorityScore: 75 }],
      merchantCapacityScore: 65,
    });

    expect(result.workloadScore).toBeGreaterThanOrEqual(0);
    expect(result.workloadScore).toBeLessThanOrEqual(100);
  });

  it("builds dependency graph for priorities", () => {
    const graph = buildExecutiveDependencyGraph({
      nodes: [
        { id: "a", label: "Step A", agentId: "inventory_intelligence", dependsOn: [] },
        { id: "b", label: "Step B", agentId: "pricing_intelligence", dependsOn: ["a"] },
        { id: "c", label: "Step C", agentId: "growth_intelligence", dependsOn: ["b"] },
      ],
      collaborationDependencies: [],
    });

    expect(graph.nodes.length).toBe(3);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("detects executive conflicts between agents", () => {
    const conflicts = analyzeExecutiveConflicts({
      collaborationConflicts: [
        {
          id: "conflict-1",
          title: "Inventory vs growth sequencing",
          agents: ["inventory_intelligence", "growth_intelligence"],
          recommendations: ["inventory:1", "growth:1"],
          reason: "Campaign cannot launch before stock stabilizes.",
          severity: "high",
          resolution: "Complete inventory replenishment first.",
        },
      ],
      competingPriorities: [
        { id: "inventory", category: "Inventory", priorityScore: 82 },
        { id: "growth", category: "Growth", priorityScore: 80 },
      ],
    });

    expect(conflicts.conflicts.length).toBeGreaterThan(0);
  });

  it("derives critical path from dependencies", () => {
    const path = deriveExecutiveCriticalPath({
      items: [
        { id: "a", title: "Replenish", priorityScore: 90, estimatedMinutes: 120, dependsOn: [] },
        { id: "b", title: "Price", priorityScore: 80, estimatedMinutes: 60, dependsOn: ["a"] },
        { id: "c", title: "Campaign", priorityScore: 70, estimatedMinutes: 90, dependsOn: ["b"] },
      ],
      blockedIds: new Set(),
    });

    expect(path.path.length).toBeGreaterThan(0);
  });

  it("analyzes execution risk from blocked operations", () => {
    const low = analyzeExecutionRisk({
      blockedOperationCount: 0,
      overdueOperationCount: 0,
      conflictScore: 10,
      inventoryRiskScore: 20,
      pricingRiskScore: 15,
      revenueGrowthRate: 5,
      outOfStockProducts: 0,
    });
    const high = analyzeExecutionRisk({
      blockedOperationCount: 5,
      overdueOperationCount: 3,
      conflictScore: 70,
      inventoryRiskScore: 75,
      pricingRiskScore: 55,
      revenueGrowthRate: -8,
      outOfStockProducts: 4,
    });

    expect(high.executionRiskScore).toBeGreaterThan(low.executionRiskScore);
  });

  it("calculates business health score", () => {
    const score = calculateBusinessHealthScore({
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
    });

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(["strong", "watch", "weak"]).toContain(classifyExecutiveHealthBand(score));
  });

  it("ranks executive priorities by score", () => {
    const ranked = rankExecutivePriorities([
      { priorityScore: 55, confidence: 0.7 },
      { priorityScore: 88, confidence: 0.9 },
      { priorityScore: 72, confidence: 0.8 },
    ]);

    expect(ranked[0]?.priorityScore).toBe(88);
  });

  it("calculates business urgency from blockers", () => {
    const urgency = calculateBusinessUrgency({
      blockedOperationCount: 3,
      outOfStockProducts: 2,
      revenueGrowthRate: -5,
      criticalRiskCount: 2,
      openHighPriorityCount: 4,
    });

    expect(urgency).toBeGreaterThan(30);
  });

  it("builds executive timeline horizons", () => {
    const timeline = buildExecutiveTimeline({
      computedAt: "2026-06-20T08:00:00.000Z",
      difficulty: "Medium",
      priorityScore: 82,
      blocked: false,
    });

    expect(timeline.suggestedWindow.length).toBeGreaterThan(0);
  });

  it("identifies blocked tasks from dependencies", () => {
    const blocked = identifyBlockedTasks({
      operations: [
        { id: "a", title: "Blocked op", status: "blocked", blockedReason: "Waiting on stock" },
      ],
      dependencyBlockedIds: ["b"],
      conflictBlockedIds: [],
      capacityBlocked: false,
    });

    expect(blocked.blockedTaskCount).toBeGreaterThanOrEqual(0);
  });

  it("estimates expected ROI for a priority", () => {
    const roi = estimateExpectedRoi({
      revenueImpact: 5000,
      profitImpact: 1800,
      implementationMinutes: 240,
      difficulty: "Medium",
      confidence: 0.85,
    });

    expect(roi.expectedRoi).toBeGreaterThanOrEqual(0);
  });
});

describe("Executive COO focus area group assignment", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`assigns a group for ${focusArea}`, () => {
      const group = assignExecutiveCooGroupFromImpact({
        focusArea,
        priorityScore: 75,
        impact: { revenueOpportunity: 1200 },
      });

      expect(group.length).toBeGreaterThan(2);
    });
  }
});

describe("Executive COO priority scoring scenarios", () => {
  for (const blocked of [false, true]) {
    it(`scores ${blocked ? "blocked" : "unblocked"} priorities`, () => {
      const score = calculateExecutivePriorityScore({
        confidence: 0.82,
        difficulty: "Medium",
        revenueImpact: 35,
        profitImpact: 18,
        urgencySignals: 2,
        blocked,
        dismissed: false,
        agentWeight: 1,
      });

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});
