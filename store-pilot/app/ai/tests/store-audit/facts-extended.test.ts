import { describe, expect, it } from "vitest";
import { createStoreAuditFactsBuilder } from "../../facts/store-audit-facts";
import { createMockStoreAuditSnapshot } from "./helpers";

describe("Store audit extended facts", () => {
  it("computes all v1 audit scores deterministically", async () => {
    const builder = createStoreAuditFactsBuilder({
      async getStoreAuditSnapshot() {
        return createMockStoreAuditSnapshot();
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "store_audit" });

    expect(facts.overallAuditScore).toBe(facts.storeHealthScore);
    expect(facts.navigationScore).toBeGreaterThan(0);
    expect(facts.technicalSeoScore).toBeGreaterThan(0);
    expect(facts.imageOptimizationScore).toBeGreaterThan(0);
    expect(facts.trustScore).toBeGreaterThan(0);
    expect(facts.policyScore).toBeGreaterThan(0);
    expect(facts.appBloatScore).toBeGreaterThan(0);
    expect(facts.merchantBestPracticesScore).toBeGreaterThan(0);
    expect(facts.images.issues.length).toBeGreaterThanOrEqual(0);
    expect(facts.trust.issues.length).toBeGreaterThanOrEqual(0);
    expect(facts.policies.refundPolicyLikely).toBe(true);
    expect(facts.technicalSeo.structuredDataLikely).toBe(true);
    expect(facts.storeSpeed.score).toBeGreaterThan(0);
  });

  it("includes new sections in critical issue count", async () => {
    const builder = createStoreAuditFactsBuilder({
      async getStoreAuditSnapshot() {
        return {
          ...createMockStoreAuditSnapshot({
            missingSku: 5,
            shortTitles: 5,
            hasCompletedOnboarding: false,
          }),
          missingAltTextProxy: 8,
        };
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "store_audit" });
    expect(facts.criticalIssueCount).toBeGreaterThan(5);
  });
});
