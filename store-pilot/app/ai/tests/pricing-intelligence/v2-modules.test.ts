import { describe, expect, it } from "vitest";

import { buildPricingIntelligenceHealthExplanation } from "../../agents/pricing-intelligence-health";
import {
  getPricingRecommendationExpirationReason,
  getPricingRecommendationVerificationReason,
  shouldExpirePricingRecommendation,
} from "../../agents/pricing-intelligence-expiration";
import { processPricingIntelligenceLifecycle } from "../../../services/pricing-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";
import { buildPricingIntelligenceFactsFromSnapshot } from "./helpers";

describe("Pricing Intelligence v2 modules", () => {
  it("builds health explanation from facts", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const health = buildPricingIntelligenceHealthExplanation(facts);

    expect(health.score).toBe(facts.pricingHealthScore);
    expect(health.drivers.length).toBeGreaterThan(0);
  });

  it("expires resolved discount recommendations", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    facts.discount.score = 95;

    expect(
      shouldExpirePricingRecommendation({
        facts,
        payload: { category: "Discount Optimization", baselineSectionScore: 70 },
        status: "open",
      }),
    ).toBe(true);
    expect(
      getPricingRecommendationExpirationReason({
        facts,
        payload: { category: "Discount Optimization" },
      }),
    ).toBe("discount_dependence_reduced");
  });

  it("verifies implemented recommendations when scores improve", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    facts.pricingHealthScore = 82;

    expect(
      getPricingRecommendationVerificationReason({
        facts,
        payload: {
          verification: { expectedMetric: "Pricing health score" },
          baselinePricingHealthScore: 60,
        },
      }),
    ).toBe(true);
  });

  it("processes lifecycle verification for implemented recommendations", async () => {
    const persistence = createInMemoryAIPersistence();
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    facts.pricingHealthScore = 82;

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "pricing_intelligence",
        subjectKey: "pricing-intelligence:store-1",
        stableId: "stable-pricing-1",
        category: "Discount Optimization",
        status: "implemented",
        runId: "run-1",
        summary: "Reduce discount dependence",
        title: "Reduce discount dependence",
        priority: 2,
        confidence: 0.9,
        payloadJson: {
          id: "pricing:discount-discipline",
          category: "Discount Optimization",
          verification: { expectedMetric: "Pricing health score" },
          baselinePricingHealthScore: 60,
        },
      },
    ]);

    const events = await processPricingIntelligenceLifecycle({
      storeId: "store-1",
      subjectKey: "pricing-intelligence:store-1",
      facts,
      persistence,
    });

    expect(events.some((event) => event.toStatus === "verified")).toBe(true);
  });
});
