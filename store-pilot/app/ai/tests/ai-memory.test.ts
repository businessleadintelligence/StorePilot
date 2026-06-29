import { describe, expect, it } from "vitest";

import { InMemoryAIMemoryRegistry } from "../core/ai-memory";

describe("AI memory interfaces", () => {
  it("exposes no-op memory interfaces for future persistence layers", async () => {
    const memory = new InMemoryAIMemoryRegistry();

    expect(await memory.store.get({ storeId: "store-1", scope: "store" })).toEqual([]);
    expect(
      (
        await memory.recommendation.put({
          id: "rec-1",
          scope: "recommendation",
          storeId: "store-1",
          payload: { recommendationId: "rec-1" },
        })
      ).payload,
    ).toEqual({ recommendationId: "rec-1" });
  });
});
