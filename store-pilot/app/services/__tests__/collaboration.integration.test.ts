import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { executeCollaboration, buildCollaborationSubjectKey } from "../collaboration.server";
import { createInMemoryAIPersistence } from "../../ai/persistence/in-memory-persistence";
import { persistCollaborationOutput } from "../../ai/collaboration/collaboration-persistence";
import { runCollaborationEngine } from "../../ai/collaboration/collaboration-engine";
import { createMockCollaborationContext, createMockRecommendations } from "../../ai/tests/collaboration/helpers";

describe("Collaboration public API", () => {
  it("builds collaboration subject key", () => {
    expect(buildCollaborationSubjectKey("store-1")).toBe("collaboration:store-1");
  });

  it("skips execution when no open specialist recommendations exist", async () => {
    const persistence = createInMemoryAIPersistence();
    const result = await executeCollaboration({
      storeId: "store-empty",
      persistence,
      skipLifecycle: true,
    });
    expect(result.status).toBe("skipped");
  });

  it("persists executive collaboration output", async () => {
    const persistence = createInMemoryAIPersistence();
    const context = createMockCollaborationContext(createMockRecommendations({ reinforced: true }));
    const output = runCollaborationEngine(context);
    const runId = randomUUID();

    await persistCollaborationOutput({
      storeId: "store-1",
      runId,
      output,
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "collaboration:store-1",
    });

    expect(records.length).toBeGreaterThan(0);
    expect(output.executiveActions.length).toBeGreaterThan(0);
  });
});

describe("Collaboration dashboard aggregation", () => {
  it("builds executive decision shape from collaboration output", () => {
    const output = runCollaborationEngine(createMockCollaborationContext(createMockRecommendations()));
    expect(output.executiveActions[0]?.agentsInvolved.length).toBeGreaterThan(0);
    expect(output.consensusScore).toBeGreaterThan(0);
    expect(output.expectedImpact.revenueLift).toBeGreaterThan(0);
  });
});
