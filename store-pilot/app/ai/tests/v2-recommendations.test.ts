import { describe, expect, it } from "vitest";

import { createInMemoryAIPersistence } from "../persistence/in-memory-persistence";
import {
  createRecommendationEngineFromRepository,
  mapCandidatesToRecommendations,
} from "../recommendations/recommendation-engine";

describe("Recommendation engine lifecycle", () => {
  it("upserts recommendations with stable ids and preserves status", async () => {
    const persistence = createInMemoryAIPersistence();
    const engine = createRecommendationEngineFromRepository(persistence.recommendations);

    const mapped = mapCandidatesToRecommendations({
      storeId: "store-1",
      agentId: "platform_template",
      runId: "run-1",
      subjectKey: "product:123",
      candidates: [
        {
          category: "inventory",
          title: "Restock Blue Hoodie",
          summary: "Low stock risk is already HIGH",
          priority: 1,
          confidence: 0.9,
        },
      ],
    });

    await engine.upsertMany(mapped);
    await engine.updateStatus({
      storeId: "store-1",
      stableId: mapped[0]!.stableId,
      status: "dismissed",
    });

    const secondRun = mapCandidatesToRecommendations({
      storeId: "store-1",
      agentId: "platform_template",
      runId: "run-2",
      subjectKey: "product:123",
      candidates: [
        {
          category: "inventory",
          title: "Restock Blue Hoodie",
          summary: "Low stock risk is already HIGH",
          priority: 1,
          confidence: 0.9,
        },
      ],
    });

    await engine.upsertMany(secondRun);

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "product:123",
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.status).toBe("dismissed");
    expect(records[0]?.runId).toBe("run-2");
  });
});
