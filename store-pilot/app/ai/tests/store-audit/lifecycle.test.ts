import { describe, expect, it } from "vitest";

import {
  getStoreAuditRecommendationExpirationReason,
  shouldExpireStoreAuditRecommendation,
  getStoreAuditRecommendationVerificationReason,
} from "../../agents/store-audit-expiration";
import { buildStoreAuditFactsFromSnapshot } from "./helpers";
import { recordStoreAuditMerchantRecommendationFeedback } from "../../../services/store-audit-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";

describe("Store Audit lifecycle and memory", () => {
  it("expires SEO recommendations when score improves", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    facts.seoScore = 85;

    expect(
      shouldExpireStoreAuditRecommendation({
        facts,
        payload: { category: "SEO", baselineSectionScore: 70 },
        status: "open",
      }),
    ).toBe(true);
    expect(
      getStoreAuditRecommendationExpirationReason({
        facts,
        payload: { category: "SEO" },
      }),
    ).toBe("seo_score_improved");
  });

  it("verifies performance improvements", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    facts.performanceScore = 78;

    expect(
      getStoreAuditRecommendationVerificationReason({
        facts,
        payload: {
          verification: { expectedMetric: "Performance score" },
          baselinePerformanceScore: 65,
        },
      }),
    ).toBe(true);
  });

  it("records merchant dismiss feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "store_audit",
        subjectKey: "store-audit:store-1",
        stableId: "stable-dismiss",
        category: "SEO",
        status: "open",
        runId: "run-1",
        summary: "Improve SEO titles",
        title: "Improve SEO titles",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "audit:seo-titles" },
      },
    ]);

    await recordStoreAuditMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "store-audit:store-1",
      stableId: "stable-dismiss",
      feedback: "dismiss",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "store-audit:store-1",
    });

    expect(records[0]?.status).toBe("dismissed");
  });

  it("records merchant snooze feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "store_audit",
        subjectKey: "store-audit:store-1",
        stableId: "stable-snooze",
        category: "Homepage",
        status: "open",
        runId: "run-1",
        summary: "Add social proof",
        title: "Add social proof",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "audit:homepage-social-proof" },
      },
    ]);

    await recordStoreAuditMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "store-audit:store-1",
      stableId: "stable-snooze",
      feedback: "snooze",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "store-audit:store-1",
    });

    expect(records[0]?.payloadJson.snoozedUntil).toBeTruthy();
  });
});
