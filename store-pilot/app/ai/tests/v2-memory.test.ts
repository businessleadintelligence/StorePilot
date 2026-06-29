import { describe, expect, it } from "vitest";

import { createInMemoryAIPersistence } from "../persistence/in-memory-persistence";
import { AgentMemoryService } from "../memory/agent-memory.service";

describe("Agent memory service", () => {
  it("loads and stores merchant dismissals for future agent context", async () => {
    const persistence = createInMemoryAIPersistence();
    const memory = new AgentMemoryService(persistence.memory);

    await memory.rememberDismissal({
      storeId: "store-1",
      subjectKey: "product:123",
      payload: { recommendationStableId: "abc", reason: "not_relevant" },
    });

    const context = await memory.loadContext({
      storeId: "store-1",
      subjectKey: "product:123",
    });

    expect(context.dismissals).toHaveLength(1);
    expect(context.dismissals[0]).toMatchObject({
      recommendationStableId: "abc",
    });
  });
});
