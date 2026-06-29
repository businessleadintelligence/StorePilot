import { describe, expect, it } from "vitest";

import { createBundleFactsBuilder } from "../../facts/bundle-facts";
import { buildCoPurchasePairs, calculateAttachRate, productsShareRelationship } from "../../tools/bundle-analysis-tool";
import { calculateBundleConfidence, passesMinimumBundleConfidence } from "../../tools/bundle-confidence-tool";
import { calculateBundleHealthScore } from "../../tools/bundle-health-tool";
import { classifyBundleOpportunity, estimatePotentialAttachRate } from "../../tools/bundle-opportunity-tool";
import { calculateBundlePriorityScore, rankBundleCandidates } from "../../tools/bundle-ranking-tool";
import { dedupeBundleCandidates } from "../../tools/bundle-similarity-tool";
import { createMockBundleSnapshot } from "./helpers";

describe("Bundle Discovery tools", () => {
  it("builds co-purchase pairs and attach rate", () => {
    const pairs = buildCoPurchasePairs([
      [{ productId: "a" }, { productId: "b" }],
      [{ productId: "a" }, { productId: "b" }],
      [{ productId: "a" }],
    ]);

    expect(pairs[0]?.coPurchaseCount).toBe(2);
    expect(calculateAttachRate(2, 3)).toBe(0.67);
  });

  it("detects shared product relationships", () => {
    const reasons = productsShareRelationship({
      left: { shopifyProductId: "1", sku: "BH-001", title: "Blue Hoodie" },
      right: { shopifyProductId: "1", sku: "BH-002", title: "Blue Beanie" },
    });

    expect(reasons).toContain("shared_collection");
    expect(reasons).toContain("shared_vendor");
  });

  it("calculates bundle confidence and health score", () => {
    const confidence = calculateBundleConfidence({
      attachRate: 0.5,
      coPurchaseCount: 8,
      sharedRelationshipCount: 2,
      inventoryCompatible: true,
    });

    expect(passesMinimumBundleConfidence(confidence)).toBe(true);
    expect(
      calculateBundleHealthScore({
        candidateCount: 3,
        highConfidenceCount: 2,
        deadInventoryPairCount: 1,
        averageConfidence: confidence,
      }),
    ).toBeGreaterThan(60);
  });

  it("classifies opportunities and ranks candidates", () => {
    const type = classifyBundleOpportunity({
      attachRate: 0.4,
      leftVelocity: 0.8,
      rightVelocity: 0.7,
      leftAgingDays: 10,
      rightAgingDays: 12,
      combinedMarginScore: 0.5,
      sharedRelationshipCount: 2,
    });

    expect(type).toBe("starter_kit");
    expect(
      estimatePotentialAttachRate({ currentAttachRate: 0.3, bundleConfidence: 0.7 }),
    ).toBeGreaterThan(0.3);

    const ranked = rankBundleCandidates([
      {
        id: "bundle:a:b",
        confidence: 0.7,
        attachRate: 0.4,
        priorityScore: calculateBundlePriorityScore({
          confidence: 0.7,
          attachRate: 0.4,
          impact: { attachRateLift: 0.1, inventoryUnitsReduced: 5, bundleOrdersExpected: 2 },
          complexity: "simple",
        }),
      },
    ]);

    expect(ranked[0]?.id).toBe("bundle:a:b");
    expect(
      dedupeBundleCandidates([
        { productIds: ["a", "b"], confidence: 0.7 },
        { productIds: ["b", "a"], confidence: 0.6 },
      ]),
    ).toHaveLength(1);
  });
});

describe("Bundle Discovery fact builder", () => {
  it("builds typed bundle facts from synchronized snapshots", async () => {
    const snapshot = createMockBundleSnapshot();
    const builder = createBundleFactsBuilder({
      async getStoreBundleSnapshot() {
        return snapshot;
      },
    });

    const facts = await builder.build({ storeId: "store-1" });

    expect(facts.bundleHealthScore).toBeGreaterThan(0);
    expect(facts.bundleCandidates.length).toBeGreaterThan(0);
    expect(facts.coPurchasePairs.length).toBeGreaterThan(0);
    expect(builder.fingerprint(facts)).toMatch(/^[a-f0-9]{64}$/);
  });
});
