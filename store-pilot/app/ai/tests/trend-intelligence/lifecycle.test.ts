import { describe, expect, it } from "vitest";
import {
  getTrendRecommendationExpirationReason,
  getTrendRecommendationVerificationReason,
  shouldExpireTrendRecommendation,
} from "../../agents/trend-intelligence-expiration";
import { buildTrendFactsFromSnapshot } from "./helpers";
import { recordTrendMerchantRecommendationFeedback } from "../../../services/trend-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";

describe("Trend Intelligence lifecycle and memory", () => {
  it("expires decline recommendations when decline resolves", () => {
    const facts = buildTrendFactsFromSnapshot();
    facts.rollingDecline.decliningProductCount = 0;
    facts.decliningProductIds = [];

    expect(
      shouldExpireTrendRecommendation({
        facts,
        payload: { category: "Declining Demand" },
        status: "open",
      }),
    ).toBe(true);
    expect(
      getTrendRecommendationExpirationReason({
        facts,
        payload: { category: "Declining Demand" },
      }),
    ).toBe("decline_resolved");
  });

  it("verifies product sales improvements", () => {
    const facts = buildTrendFactsFromSnapshot();

    expect(
      getTrendRecommendationVerificationReason({
        facts,
        payload: {
          productId: "product-1",
          verification: { expectedMetric: "Product sales" },
          baselineSales30Days: 30,
        },
      }),
    ).toBe(true);
  });

  it("records merchant dismiss feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "trend_intelligence",
        subjectKey: "trend:store-1",
        stableId: "stable-dismiss",
        category: "Emerging Opportunity",
        status: "open",
        runId: "run-1",
        summary: "Restock hoodie",
        title: "Restock hoodie",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "trend:restock-blue-hoodie" },
      },
    ]);

    await recordTrendMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "trend:store-1",
      stableId: "stable-dismiss",
      feedback: "dismiss",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "trend:store-1",
    });

    expect(records[0]?.status).toBe("dismissed");
  });

  it("records merchant snooze feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "trend_intelligence",
        subjectKey: "trend:store-1",
        stableId: "stable-snooze",
        category: "Declining Demand",
        status: "open",
        runId: "run-1",
        summary: "Discount beanie",
        title: "Discount beanie",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "trend:discount-beanie" },
      },
    ]);

    await recordTrendMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "trend:store-1",
      stableId: "stable-snooze",
      feedback: "snooze",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "trend:store-1",
    });

    expect(records[0]?.payloadJson.snoozedUntil).toBeTruthy();
  });
});
