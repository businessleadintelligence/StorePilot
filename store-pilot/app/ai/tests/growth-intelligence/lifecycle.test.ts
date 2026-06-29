import { describe, expect, it } from "vitest";

import {
  getGrowthRecommendationExpirationReason,
  shouldExpireGrowthRecommendation,
  getGrowthRecommendationVerificationReason,
} from "../../agents/growth-intelligence-expiration";
import { buildGrowthIntelligenceFactsFromSnapshot } from "./helpers";
import { recordGrowthMerchantRecommendationFeedback } from "../../../services/growth-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";

describe("Growth Intelligence lifecycle and memory", () => {
  it("expires retention recommendations when score improves", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    facts.retention.retentionScore = 72;

    expect(
      shouldExpireGrowthRecommendation({
        facts,
        payload: { category: "Retention", baselineSectionScore: 55 },
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

  it("verifies retention improvements", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    facts.retention.retentionScore = 64;

    expect(
      getGrowthRecommendationVerificationReason({
        facts,
        payload: {
          verification: { expectedMetric: "Retention score" },
          baselineRetentionScore: 55,
        },
      }),
    ).toBe(true);
  });

  it("records merchant dismiss feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "growth_intelligence",
        subjectKey: "growth-intelligence:store-1",
        stableId: "stable-dismiss",
        category: "Retention",
        status: "open",
        runId: "run-1",
        summary: "Improve repeat purchase rate",
        title: "Improve repeat purchase rate",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "growth:retention-winback" },
      },
    ]);

    await recordGrowthMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "growth-intelligence:store-1",
      stableId: "stable-dismiss",
      feedback: "dismiss",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "growth-intelligence:store-1",
    });

    expect(records[0]?.status).toBe("dismissed");
  });

  it("records merchant snooze feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "growth_intelligence",
        subjectKey: "growth-intelligence:store-1",
        stableId: "stable-snooze",
        category: "Upsell",
        status: "open",
        runId: "run-1",
        summary: "Launch upsell campaign",
        title: "Launch upsell campaign",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "growth:upsell-campaign" },
      },
    ]);

    await recordGrowthMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "growth-intelligence:store-1",
      stableId: "stable-snooze",
      feedback: "snooze",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "growth-intelligence:store-1",
    });

    expect(records[0]?.payloadJson.snoozedUntil).toBeTruthy();
  });
});
