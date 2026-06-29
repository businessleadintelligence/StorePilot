import { describe, expect, it } from "vitest";
import {
  buildCollaborationContextFromInputs,
  buildCollaborationMemoryFromRecords,
} from "../../collaboration/collaboration-context";
import { runCollaborationEngine } from "../../collaboration/collaboration-engine";
import { detectCollaborationConflicts } from "../../collaboration/collaboration-conflicts";
import { detectCollaborationDependencies } from "../../collaboration/collaboration-dependencies";
import { clusterRecommendationsForMerge } from "../../collaboration/collaboration-merge";
import { CollaborationValidationError, validateCollaborationOutput } from "../../collaboration/collaboration-validator";
import { buildCollaborationChartData } from "../../collaboration/collaboration-timeline";
import type { CollaborationRecommendationInput } from "../../collaboration/collaboration-types";
import { createMockCollaborationContext, createMockRecommendations } from "./helpers";

describe("Collaboration merge and reinforcement", () => {
  it("merges aligned recommendations into one executive action", () => {
    const recommendations = createMockRecommendations();
    const context = createMockCollaborationContext(recommendations);
    const output = runCollaborationEngine(context);
    expect(output.executiveActions.length).toBeLessThan(recommendations.length);
    expect(output.executiveActions[0]?.agentsInvolved.length).toBeGreaterThan(1);
  });

  it("boosts reinforced clusters with three or more agents", () => {
    const recommendations = createMockRecommendations({ reinforced: true });
    const clusters = clusterRecommendationsForMerge(recommendations);
    expect(clusters.some((cluster) => cluster.reinforced)).toBe(true);
  });
});

describe("Collaboration conflicts and dependencies", () => {
  it("detects inventory versus trend conflicts", () => {
    const recommendations = createMockRecommendations({ withConflict: true });
    const conflicts = detectCollaborationConflicts(recommendations);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]?.severity).toBe("high");
  });

  it("detects bundle dependencies on inventory", () => {
    const recommendations = createMockRecommendations({ withDependency: true });
    const dependencies = detectCollaborationDependencies(recommendations);
    expect(dependencies.length).toBeGreaterThan(0);
  });
});

describe("Collaboration validation", () => {
  it("rejects duplicate executive action ids", () => {
    const context = createMockCollaborationContext(createMockRecommendations());
    const output = runCollaborationEngine(context);
    output.executiveActions.push({ ...output.executiveActions[0]! });
    expect(() => validateCollaborationOutput(context, output)).toThrow(CollaborationValidationError);
  });

  it("rejects unknown recommendation ids", () => {
    const context = createMockCollaborationContext(createMockRecommendations());
    const output = runCollaborationEngine(context);
    output.executiveActions[0]!.sourceRecommendationIds = ["unknown-id"];
    expect(() => validateCollaborationOutput(context, output)).toThrow(CollaborationValidationError);
  });
});

describe("Collaboration charts and memory", () => {
  it("builds chart data from collaboration output", () => {
    const output = runCollaborationEngine(createMockCollaborationContext(createMockRecommendations()));
    const charts = buildCollaborationChartData(output);
    expect(charts.consensusGauge.length).toBeGreaterThan(0);
    expect(charts.agentInfluenceRadar.length).toBeGreaterThan(0);
  });

  it("filters implemented executive actions from memory", () => {
    const memory = buildCollaborationMemoryFromRecords([
      {
        stableId: "stable-1",
        status: "implemented",
        payloadJson: { id: "executive:action-1", executiveActionId: "executive:action-1" },
      },
    ]);
    expect(memory.implementedExecutiveIds.has("executive:action-1")).toBe(true);
  });
});

describe("Collaboration context builder", () => {
  it("excludes dismissed recommendations from active context", () => {
    const recommendations = createMockRecommendations();
    const context = buildCollaborationContextFromInputs({
      storeId: "store-1",
      recommendations,
      agentResults: [],
      memory: buildCollaborationMemoryFromRecords([
        {
          stableId: "stable-dismiss",
          status: "dismissed",
          payloadJson: { id: recommendations[0]!.recommendationId },
        },
      ]),
      storeMetrics: {
        storeHealth: 80,
        revenueHealth: 70,
        inventoryHealth: 75,
        growthScore: 65,
      },
    });
    expect(context.recommendations.some((item) => item.recommendationId === recommendations[0]?.recommendationId)).toBe(false);
  });
});
