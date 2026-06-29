import { describe, expect, it } from "vitest";

import { buildSeoIntelligenceHealthExplanation } from "../../agents/seo-intelligence-health";
import {
  getSeoRecommendationExpirationReason,
  getSeoRecommendationVerificationReason,
  shouldExpireSeoRecommendation,
} from "../../agents/seo-intelligence-expiration";
import { processSeoIntelligenceLifecycle } from "../../../services/seo-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";
import { buildSeoIntelligenceFactsFromSnapshot } from "./helpers";

describe("SEO Intelligence v2 modules", () => {
  it("builds health explanation from facts", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const health = buildSeoIntelligenceHealthExplanation(facts);

    expect(health.score).toBe(facts.seoHealthScore);
    expect(health.drivers.length).toBeGreaterThan(0);
  });

  it("expires resolved metadata recommendations", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    facts.scores.contentScore = 95;

    expect(
      shouldExpireSeoRecommendation({
        facts,
        payload: { category: "Metadata", baselineSectionScore: 80 },
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

  it("verifies implemented recommendations when scores improve", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    facts.seoHealthScore = 82;

    expect(
      getSeoRecommendationVerificationReason({
        facts,
        payload: {
          verification: { expectedMetric: "SEO health score" },
          baselineSeoHealthScore: 60,
        },
      }),
    ).toBe(true);
  });

  it("processes lifecycle verification for implemented recommendations", async () => {
    const persistence = createInMemoryAIPersistence();
    const facts = await buildSeoIntelligenceFactsFromSnapshot();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "seo_audit",
        subjectKey: "seo-intelligence:store-1",
        stableId: "stable-seo-1",
        category: "Metadata",
        status: "implemented",
        runId: "run-1",
        summary: "Improve metadata coverage",
        title: "Improve metadata coverage",
        priority: 2,
        confidence: 0.9,
        payloadJson: {
          id: "seo:metadata-titles",
          category: "Metadata",
          verification: { expectedMetric: "SEO health score" },
          baselineSeoHealthScore: 60,
        },
      },
    ]);

    facts.seoHealthScore = 82;

    const events = await processSeoIntelligenceLifecycle({
      storeId: "store-1",
      subjectKey: "seo-intelligence:store-1",
      facts,
      persistence,
    });

    expect(events.some((event) => event.toStatus === "verified")).toBe(true);
  });
});
