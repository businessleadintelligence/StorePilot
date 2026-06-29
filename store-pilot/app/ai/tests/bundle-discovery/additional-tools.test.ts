import { describe, expect, it } from "vitest";

import { estimateBundleImpact, passesBundleSafetyConstraints } from "../../tools/bundle-impact-tool";
import { assignBundleRecommendationGroup, buildBundleRecommendationGroups } from "../../tools/bundle-group-tool";
import { processBundleDiscoveryLifecycle } from "../../../services/bundle-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";
import { buildBundleDiscoverySubjectKey } from "../../../services/bundle-intelligence.server";
import { buildBundleFactsFromSnapshot } from "./helpers";

describe("Bundle Discovery additional tools", () => {
  it("estimates bundle impact and enforces safety constraints", () => {
    const impact = estimateBundleImpact({
      bundleConfidence: 0.8,
      attachRate: 0.4,
      inventoryReduction: 6,
      combinedPrice: 68,
    });

    expect(impact.attachRateLift).toBeGreaterThan(0);
    expect(
      passesBundleSafetyConstraints({
        productCount: 2,
        inventoryCompatible: true,
        confidence: 0.7,
      }),
    ).toBe(true);
  });

  it("builds bundle recommendation groups", () => {
    const groups = buildBundleRecommendationGroups([
      { id: "bundle:a:b", group: "Top Bundle Opportunities" },
      { id: "bundle:c:d", group: "Quick Win Bundles" },
    ]);

    expect(groups.topBundleOpportunities).toEqual(["bundle:a:b"]);
    expect(
      assignBundleRecommendationGroup({
        category: "Dead Inventory Bundle",
        priorityScore: 40,
        bundleType: "dead_inventory_bundle",
      }),
    ).toBe("Inventory Recovery Bundles");
  });
});

describe("Bundle Discovery lifecycle", () => {
  it("closes expired bundle recommendations", async () => {
    const persistence = createInMemoryAIPersistence();
    const facts = buildBundleFactsFromSnapshot();
    facts.candidateCount = 0;
    facts.bundleHealthScore = 85;
    facts.highConfidenceCount = 0;
    const subjectKey = buildBundleDiscoverySubjectKey("store-1");

    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "bundle_discovery",
        runId: "run-1",
        subjectKey,
        stableId: "stable-1",
        category: "Starter Kit",
        title: "Old bundle",
        summary: "Bundle recommendation pending expiration",
        status: "open",
        priority: 2,
        confidence: 0.8,
        payloadJson: {
          id: "bundle:product-1:product-2",
          category: "Starter Kit",
          bundleProductIds: ["product-1", "product-2"],
        },
      },
    ]);

    const events = await processBundleDiscoveryLifecycle({
      storeId: "store-1",
      subjectKey,
      facts,
      persistence,
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.toStatus).toBe("closed");
  });
});
