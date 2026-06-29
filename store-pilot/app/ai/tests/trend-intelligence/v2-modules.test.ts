import { describe, expect, it } from "vitest";
import { buildTrendHealthExplanation } from "../../agents/trend-intelligence-health";
import {
  getTrendRecommendationExpirationReason,
  getTrendRecommendationVerificationReason,
  shouldExpireTrendRecommendation,
} from "../../agents/trend-intelligence-expiration";
import { processTrendIntelligenceLifecycle } from "../../../services/trend-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";
import { buildTrendFactsFromSnapshot } from "./helpers";

describe("Trend Intelligence v2 modules", () => {
  it("builds health explanation", () => {
    const explanation = buildTrendHealthExplanation(buildTrendFactsFromSnapshot());
    expect(explanation.drivers.length).toBe(4);
  });

  it("expires resolved decline recommendations", () => {
    const facts = buildTrendFactsFromSnapshot();
    facts.decliningProductIds = [];
    facts.rollingDecline.decliningProductCount = 0;
    facts.rollingDecline.decliningProductCount = 0;
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

  it("verifies implemented trend recommendations", () => {
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

  it("processes lifecycle verification", async () => {
    const persistence = createInMemoryAIPersistence();
    const facts = buildTrendFactsFromSnapshot();
    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "trend_intelligence",
        subjectKey: "trend:store-1",
        stableId: "stable-trend-1",
        category: "Emerging Opportunity",
        status: "implemented",
        runId: "run-1",
        summary: "Restock hoodie",
        title: "Restock hoodie",
        priority: 2,
        confidence: 0.9,
        payloadJson: {
          id: "trend:restock-blue-hoodie",
          productId: "product-1",
          verification: { expectedMetric: "Product sales" },
          baselineSales30Days: 30,
        },
      },
    ]);

    const events = await processTrendIntelligenceLifecycle({
      storeId: "store-1",
      subjectKey: "trend:store-1",
      facts,
      persistence,
    });

    expect(events.some((event) => event.toStatus === "verified")).toBe(true);
  });
});
