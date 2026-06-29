import { describe, expect, it } from "vitest";

import {
  getSeoRecommendationExpirationReason,
  shouldExpireSeoRecommendation,
  getSeoRecommendationVerificationReason,
} from "../../agents/seo-intelligence-expiration";
import { buildSeoIntelligenceFactsFromSnapshot } from "./helpers";
import { recordSeoMerchantRecommendationFeedback } from "../../../services/seo-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";

describe("SEO Intelligence lifecycle and memory", () => {
  it("expires metadata recommendations when score improves", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    facts.scores.contentScore = 92;

    expect(
      shouldExpireSeoRecommendation({
        facts,
        payload: { category: "Metadata", baselineSectionScore: 70 },
        status: "open",
      }),
    ).toBe(true);
    expect(
      getSeoRecommendationExpirationReason({
        facts,
        payload: { category: "Metadata" },
      }),
    ).toBe("metadata_score_improved");
  });

  it("verifies search visibility improvements", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    facts.scores.searchVisibilityScore = 82;

    expect(
      getSeoRecommendationVerificationReason({
        facts,
        payload: {
          verification: { expectedMetric: "Search visibility score" },
          baselineSearchVisibilityScore: 65,
        },
      }),
    ).toBe(true);
  });

  it("records merchant dismiss feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "seo_audit",
        subjectKey: "seo-intelligence:store-1",
        stableId: "stable-dismiss",
        category: "Metadata",
        status: "open",
        runId: "run-1",
        summary: "Improve metadata titles",
        title: "Improve metadata titles",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "seo:metadata-titles" },
      },
    ]);

    await recordSeoMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "seo-intelligence:store-1",
      stableId: "stable-dismiss",
      feedback: "dismiss",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "seo-intelligence:store-1",
    });

    expect(records[0]?.status).toBe("dismissed");
  });

  it("records merchant snooze feedback", async () => {
    const persistence = createInMemoryAIPersistence();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "seo_audit",
        subjectKey: "seo-intelligence:store-1",
        stableId: "stable-snooze",
        category: "Images",
        status: "open",
        runId: "run-1",
        summary: "Add alt text",
        title: "Add alt text",
        priority: 2,
        confidence: 0.8,
        payloadJson: { id: "seo:image-alt-text" },
      },
    ]);

    await recordSeoMerchantRecommendationFeedback({
      storeId: "store-1",
      subjectKey: "seo-intelligence:store-1",
      stableId: "stable-snooze",
      feedback: "snooze",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "seo-intelligence:store-1",
    });

    expect(records[0]?.payloadJson.snoozedUntil).toBeTruthy();
  });
});
