import { describe, expect, it } from "vitest";

import { buildGrowthIntelligenceHealthExplanation } from "../../agents/growth-intelligence-health";
import {
  getGrowthRecommendationExpirationReason,
  getGrowthRecommendationVerificationReason,
  shouldExpireGrowthRecommendation,
} from "../../agents/growth-intelligence-expiration";
import { processGrowthIntelligenceLifecycle } from "../../../services/growth-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";
import { buildGrowthIntelligenceFactsFromSnapshot } from "./helpers";

describe("Growth Intelligence v2 modules", () => {
  it("builds health explanation from facts", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const health = buildGrowthIntelligenceHealthExplanation(facts);

    expect(health.score).toBe(facts.growthHealthScore);
    expect(health.drivers.length).toBeGreaterThan(0);
  });

  it("expires resolved retention recommendations", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    facts.retention.retentionScore = 95;

    expect(
      shouldExpireGrowthRecommendation({
        facts,
        payload: { category: "Retention", baselineSectionScore: 70 },
        status: "open",
      }),
    ).toBe(true);
    expect(
      getGrowthRecommendationExpirationReason({
        facts,
        payload: { category: "Retention" },
      }),
    ).toBe("retention_improved");
  });

  it("verifies implemented recommendations when scores improve", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    facts.growthHealthScore = 82;

    expect(
      getGrowthRecommendationVerificationReason({
        facts,
        payload: {
          verification: { expectedMetric: "Growth health score" },
          baselineGrowthHealthScore: 60,
        },
      }),
    ).toBe(true);
  });

  it("processes lifecycle verification for implemented recommendations", async () => {
    const persistence = createInMemoryAIPersistence();
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    facts.growthHealthScore = 82;

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "growth_intelligence",
        subjectKey: "growth-intelligence:store-1",
        stableId: "stable-growth-1",
        category: "Retention",
        status: "implemented",
        runId: "run-1",
        summary: "Improve repeat purchase rate",
        title: "Improve repeat purchase rate",
        priority: 2,
        confidence: 0.9,
        payloadJson: {
          id: "growth:retention-winback",
          category: "Retention",
          verification: { expectedMetric: "Growth health score" },
          baselineGrowthHealthScore: 60,
        },
      },
    ]);

    const events = await processGrowthIntelligenceLifecycle({
      storeId: "store-1",
      subjectKey: "growth-intelligence:store-1",
      facts,
      persistence,
    });

    expect(events.some((event) => event.toStatus === "verified")).toBe(true);
  });
});
