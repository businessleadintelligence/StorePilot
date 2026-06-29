import { describe, expect, it } from "vitest";

import {
  getPricingRecommendationExpirationReason,
  shouldExpirePricingRecommendation,
  getPricingRecommendationVerificationReason,
} from "../../agents/pricing-intelligence-expiration";
import { buildPricingIntelligenceFactsFromSnapshot } from "./helpers";
import { recordPricingMerchantRecommendationFeedback } from "../../../services/pricing-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";

describe("Pricing Intelligence lifecycle and memory", () => {
  it("expires discount recommendations when score improves", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    facts.discount.score = 92;

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

  it("verifies margin improvements", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    facts.margin.marginPercent = 44;

    expect(
      getPricingRecommendationVerificationReason({
        facts,
        payload: {
          verification: { expectedMetric: "Margin percent" },
          baselineMarginPercent: 35,
        },
      }),
    ).toBe(true);
  });

  it("records merchant dismiss feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "pricing_intelligence",
        subjectKey: "pricing-intelligence:store-1",
        stableId: "stable-dismiss",
        category: "Discount Optimization",
        status: "open",
        runId: "run-1",
        summary: "Reduce discount dependence",
        title: "Reduce discount dependence",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "pricing:discount-discipline" },
      },
    ]);

    await recordPricingMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "pricing-intelligence:store-1",
      stableId: "stable-dismiss",
      feedback: "dismiss",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "pricing-intelligence:store-1",
    });

    expect(records[0]?.status).toBe("dismissed");
  });

  it("records merchant snooze feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "pricing_intelligence",
        subjectKey: "pricing-intelligence:store-1",
        stableId: "stable-snooze",
        category: "Premium Pricing",
        status: "open",
        runId: "run-1",
        summary: "Raise premium prices",
        title: "Raise premium prices",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "pricing:premium-raise" },
      },
    ]);

    await recordPricingMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "pricing-intelligence:store-1",
      stableId: "stable-snooze",
      feedback: "snooze",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "pricing-intelligence:store-1",
    });

    expect(records[0]?.payloadJson.snoozedUntil).toBeTruthy();
  });
});
