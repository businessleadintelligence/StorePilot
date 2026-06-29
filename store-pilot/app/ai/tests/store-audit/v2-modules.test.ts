import { describe, expect, it } from "vitest";

import { buildStoreAuditHealthExplanation } from "../../agents/store-audit-health";
import {
  getStoreAuditRecommendationExpirationReason,
  getStoreAuditRecommendationVerificationReason,
  shouldExpireStoreAuditRecommendation,
} from "../../agents/store-audit-expiration";
import { processStoreAuditLifecycle } from "../../../services/store-audit-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";
import { buildStoreAuditFactsFromSnapshot } from "./helpers";

describe("Store Audit v2 modules", () => {
  it("builds health explanation from facts", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const health = buildStoreAuditHealthExplanation(facts);

    expect(health.score).toBe(facts.storeHealthScore);
    expect(health.drivers.length).toBeGreaterThan(0);
  });

  it("expires resolved app recommendations", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    facts.apps.unusedApps = 0;

    expect(
      shouldExpireStoreAuditRecommendation({
        facts,
        payload: { category: "Apps" },
        status: "open",
      }),
    ).toBe(true);
    expect(
      getStoreAuditRecommendationExpirationReason({
        facts,
        payload: { category: "Apps" },
      }),
    ).toBe("unused_apps_resolved");
  });

  it("verifies implemented recommendations when scores improve", () => {
    const facts = buildStoreAuditFactsFromSnapshot();

    expect(
      getStoreAuditRecommendationVerificationReason({
        facts,
        payload: {
          verification: { expectedMetric: "Store health score" },
          baselineStoreHealthScore: 60,
        },
      }),
    ).toBe(true);
  });

  it("processes lifecycle verification for implemented recommendations", async () => {
    const persistence = createInMemoryAIPersistence();
    const facts = buildStoreAuditFactsFromSnapshot();

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "store_audit",
        subjectKey: "store-audit:store-1",
        stableId: "stable-audit-1",
        category: "SEO",
        status: "implemented",
        runId: "run-1",
        summary: "Improve SEO title coverage",
        title: "Improve SEO title coverage",
        priority: 2,
        confidence: 0.9,
        payloadJson: {
          id: "audit:seo-titles",
          category: "SEO",
          verification: { expectedMetric: "SEO score" },
          baselineSeoScore: 60,
        },
      },
    ]);

    facts.seoScore = 80;

    const events = await processStoreAuditLifecycle({
      storeId: "store-1",
      subjectKey: "store-audit:store-1",
      facts,
      persistence,
    });

    expect(events.some((event) => event.toStatus === "verified")).toBe(true);
  });
});
