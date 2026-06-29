import { describe, expect, it } from "vitest";

import {
  buildInventoryEvidenceCatalog,
  resolveInventoryEvidenceFromKeys,
} from "../../agents/inventory-intelligence-evidence";
import {
  estimateInventoryRecommendationImpactForFacts,
  hasInventoryDeterministicImpact,
} from "../../agents/inventory-intelligence-impact";
import {
  assignInventoryRecommendationGroup,
  buildInventoryRecommendationGroups,
} from "../../agents/inventory-intelligence-groups";
import { buildInventoryHealthExplanation } from "../../agents/inventory-intelligence-health";
import {
  dedupeSimilarInventoryRecommendations,
} from "../../agents/inventory-intelligence-similarity";
import {
  getInventoryRecommendationExpirationReason,
  shouldExpireInventoryRecommendation,
} from "../../agents/inventory-intelligence-expiration";
import { enrichInventoryIntelligenceOutput } from "../../agents/inventory-intelligence-enrichment";
import { processInventoryIntelligenceLifecycle } from "../../../services/inventory-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";
import {
  buildInventoryFactsFromSnapshot,
  buildValidInventoryIntelligenceDraft,
} from "./helpers";

describe("Inventory Intelligence v2 modules", () => {
  it("builds evidence catalog entries from facts", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const catalog = buildInventoryEvidenceCatalog(facts);
    const evidence = resolveInventoryEvidenceFromKeys(["stockout_alerts", "inventory_health_score"], catalog);

    expect(evidence[0]).toContain("Stockout alerts");
    expect(evidence[1]).toContain("Inventory health score");
  });

  it("estimates inventory-only impact without revenue fields", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const impact = estimateInventoryRecommendationImpactForFacts(facts, {
      id: "reorder:product-1",
      category: "Reorder",
    });

    expect(hasInventoryDeterministicImpact(impact)).toBe(true);
    expect(impact.ordersProtected).toBeGreaterThan(0);
    expect(impact).not.toHaveProperty("revenueRecovered");
  });

  it("assigns inventory recommendation groups and dedupes similar items", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const draft = buildValidInventoryIntelligenceDraft(facts);
    const deduped = dedupeSimilarInventoryRecommendations([
      draft.recommendations[0],
      {
        ...draft.recommendations[0],
        id: "reorder:product-1-copy",
        title: "Reorder Blue Hoodie inventory urgently",
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(
      assignInventoryRecommendationGroup({
        category: draft.recommendations[0].category,
        priorityScore: 88,
        hasDeterministicImpact: true,
        stockoutAlertCount: facts.stockoutAlertCount,
      }),
    ).toBe("Critical Inventory Risks");
    expect(
      buildInventoryRecommendationGroups([
        { id: draft.recommendations[0].id, group: "Critical Inventory Risks" },
      ]).criticalInventoryRisks,
    ).toEqual([draft.recommendations[0].id]);
  });

  it("builds health explanation and expiration rules", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const explanation = buildInventoryHealthExplanation(facts);

    expect(explanation.score).toBe(facts.inventoryHealthScore);
    expect(explanation.drivers.length).toBeGreaterThan(0);

    const resolvedFacts = {
      ...facts,
      stockoutAlertCount: 0,
      deadStockCount: 0,
      overstockCount: 0,
      inventoryHealthScore: 85,
    };

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

  it("enriches draft output and verifies implemented recommendations", async () => {
    const facts = buildInventoryFactsFromSnapshot();
    const draft = buildValidInventoryIntelligenceDraft(facts);
    const enriched = enrichInventoryIntelligenceOutput({ facts, output: draft });

    expect(enriched.recommendations[0].tasks.length).toBeGreaterThan(0);
    expect(enriched.deadStockCount).toBe(facts.deadStockCount);

    const persistence = createInMemoryAIPersistence();
    await persistence.recommendations.upsertMany([
      {
        stableId: "stable-1",
        storeId: "store-1",
        agentId: "inventory_intelligence",
        runId: "run-1",
        subjectKey: "inventory:store-1",
        category: "Reorder",
        title: draft.recommendations[0].title,
        summary: draft.recommendations[0].reason,
        priority: 1,
        confidence: 0.9,
        status: "implemented",
        payloadJson: {
          ...draft.recommendations[0],
          verification: { expectedMetric: "Inventory Days", expectedDirection: "Increase" },
        },
      },
    ]);

    const events = await processInventoryIntelligenceLifecycle({
      storeId: "store-1",
      subjectKey: "inventory:store-1",
      facts: { ...facts, averageDaysRemaining: 20 },
      persistence,
    });

    expect(events.some((event) => event.toStatus === "verified")).toBe(true);
  });
});
