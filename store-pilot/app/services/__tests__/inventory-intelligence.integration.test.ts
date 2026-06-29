import { describe, expect, it } from "vitest";

import {
  buildInventoryIntelligenceSubjectKey,
} from "../inventory-intelligence.server";
import {
  areInventoryRecommendationsSimilar,
  dedupeSimilarInventoryRecommendations,
} from "../../ai/agents/inventory-intelligence-similarity";
import {
  getInventoryRecommendationExpirationReason,
  shouldExpireInventoryRecommendation,
} from "../../ai/agents/inventory-intelligence-expiration";
import { buildInventoryFactsFromSnapshot } from "../../ai/tests/inventory-intelligence/helpers";

describe("Inventory Intelligence integration helpers", () => {
  it("uses store-scoped subject keys", () => {
    expect(buildInventoryIntelligenceSubjectKey("abc")).toBe("inventory:abc");
  });

  it("dedupes similar inventory recommendations by title cluster", () => {
    const deduped = dedupeSimilarInventoryRecommendations([
      {
        id: "reorder:product-1",
        category: "Reorder",
        title: "Reorder Blue Hoodie before stockout",
        reason: "Low coverage",
        evidenceKeys: ["stockout_alerts"],
        merchantAction: ["Reorder"],
        estimatedDifficulty: "Easy",
        confidence: 0.9,
        expectedResult: "Restore coverage",
        potentialRisk: "Demand softens",
        estimatedTime: "1 week",
        businessImpact: "Protect fulfillment",
      },
      {
        id: "reorder:product-1b",
        category: "Reorder",
        title: "Reorder Blue Hoodie inventory urgently",
        reason: "Low coverage again",
        evidenceKeys: ["stockout_alerts"],
        merchantAction: ["Reorder now"],
        estimatedDifficulty: "Easy",
        confidence: 0.8,
        expectedResult: "Restore coverage",
        potentialRisk: "Demand softens",
        estimatedTime: "1 week",
        businessImpact: "Protect fulfillment",
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(
      areInventoryRecommendationsSimilar(
        { category: "Reorder", title: "Reorder Blue Hoodie before stockout" },
        { category: "Reorder", title: "Reorder Blue Hoodie inventory urgently" },
      ),
    ).toBe(true);
  });

  it("expires resolved stockout recommendations", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const resolvedFacts = { ...facts, stockoutAlertCount: 0, inventoryHealthScore: 85, deadStockCount: 0 };

    expect(
      getInventoryRecommendationExpirationReason({
        facts: resolvedFacts,
        payload: { category: "Stockout" },
      }),
    ).toBe("stockout_resolved");
    expect(
      shouldExpireInventoryRecommendation({
        facts: resolvedFacts,
        payload: { category: "Stockout" },
        status: "open",
      }),
    ).toBe(true);
  });

  it("does not expire verified recommendations", () => {
    const facts = buildInventoryFactsFromSnapshot();
    expect(
      shouldExpireInventoryRecommendation({
        facts,
        payload: { category: "Stockout" },
        status: "verified",
      }),
    ).toBe(false);
  });

  it("keeps dissimilar inventory recommendations separate", () => {
    expect(
      areInventoryRecommendationsSimilar(
        { category: "Reorder", title: "Reorder Blue Hoodie before stockout" },
        { category: "Clearance", title: "Launch clearance offer for stale units" },
      ),
    ).toBe(false);
  });
});
