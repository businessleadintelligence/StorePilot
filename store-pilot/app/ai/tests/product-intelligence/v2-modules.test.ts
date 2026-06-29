import { describe, expect, it } from "vitest";

import { buildEvidenceCatalog, resolveEvidenceFromKeys } from "../../agents/product-intelligence-evidence";
import {
  estimateRecommendationImpact,
  hasDeterministicImpact,
} from "../../agents/product-intelligence-impact";
import {
  buildMerchantPreferenceProfile,
  calculatePriorityScore,
  rankRecommendations,
} from "../../agents/product-intelligence-ranking";
import {
  areRecommendationsSimilar,
  dedupeSimilarRecommendations,
} from "../../agents/product-intelligence-similarity";
import { assignRecommendationGroup, buildRecommendationGroups } from "../../agents/product-intelligence-groups";
import { buildHealthExplanation } from "../../agents/product-intelligence-health";
import {
  getRecommendationExpirationReason,
  shouldExpireRecommendation,
} from "../../agents/product-intelligence-expiration";
import { enrichProductIntelligenceOutput } from "../../agents/product-intelligence-enrichment";
import { processProductIntelligenceLifecycle } from "../../../services/product-intelligence-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";
import { buildFactsWithHealthScore, buildValidProductIntelligenceDraft } from "./helpers";

describe("Product Intelligence evidence engine", () => {
  it("builds deterministic evidence from facts", () => {
    const facts = buildFactsWithHealthScore();
    const catalog = buildEvidenceCatalog(facts);
    const evidence = resolveEvidenceFromKeys(["sales_30d", "health_score"], catalog);

    expect(evidence[0]).toContain("30 day sales");
    expect(evidence[1]).toContain("Health score");
  });
});

describe("Product Intelligence impact estimation", () => {
  it("calculates deterministic inventory impact for high stock risk", () => {
    const facts = buildFactsWithHealthScore();
    facts.stockRisk = "CRITICAL";
    facts.daysRemaining = 6;
    facts.velocity = 2;

    const impact = estimateRecommendationImpact(facts, {
      id: "inventory-replenishment-plan",
      category: "Inventory",
    });

    expect(hasDeterministicImpact(impact)).toBe(true);
    expect(impact.ordersProtected).toBeGreaterThan(0);
  });
});

describe("Product Intelligence ranking", () => {
  it("ranks recommendations by priority score", () => {
    const facts = buildFactsWithHealthScore();
    const draft = buildValidProductIntelligenceDraft(facts);
    const impacts = new Map(
      draft.recommendations.map((recommendation) => [
        recommendation.id,
        estimateRecommendationImpact(facts, recommendation),
      ]),
    );

    const ranked = rankRecommendations({
      facts,
      recommendations: draft.recommendations,
      impacts,
    });

    expect(ranked[0].priorityScore).toBeGreaterThanOrEqual(ranked[1]?.priorityScore ?? 0);
    expect(calculatePriorityScore({
      facts,
      recommendation: draft.recommendations[0],
      impact: impacts.get(draft.recommendations[0].id) ?? {},
    })).toBeGreaterThan(0);
  });

  it("learns from dismissed merchant categories", () => {
    const preferences = buildMerchantPreferenceProfile([
      {
        category: "Inventory",
        status: "dismissed",
        payloadJson: { feedback: "dismiss" },
      },
    ]);

    const facts = buildFactsWithHealthScore();
    const recommendation = buildValidProductIntelligenceDraft(facts).recommendations[0];
    const impact = estimateRecommendationImpact(facts, recommendation);

    const withoutPreference = calculatePriorityScore({ facts, recommendation, impact });
    const withPreference = calculatePriorityScore({
      facts,
      recommendation,
      impact,
      preferences,
    });

    expect(withPreference).toBeLessThan(withoutPreference);
  });
});

describe("Product Intelligence similarity detection", () => {
  it("detects near duplicate inventory recommendations", () => {
    const left = { category: "Inventory" as const, title: "Increase inventory for Protein Powder" };
    const right = { category: "Inventory" as const, title: "Reorder inventory for Protein Powder" };

    expect(areRecommendationsSimilar(left, right)).toBe(true);
  });

  it("dedupes similar recommendations keeping the highest score", () => {
    const deduped = dedupeSimilarRecommendations([
      {
        id: "a",
        category: "Inventory",
        title: "Increase inventory for Protein Powder",
        reason: "Low stock",
        evidenceKeys: ["inventory_days"],
        merchantAction: ["Order units"],
        difficulty: "Easy",
        confidence: 0.8,
        expectedResult: "More stock",
        potentialRisk: "Cash tied up",
        estimatedTime: "1 week",
        businessImpact: "Protect revenue",
        priorityScore: 70,
      },
      {
        id: "b",
        category: "Inventory",
        title: "Restock inventory for Protein Powder",
        reason: "Low stock",
        evidenceKeys: ["inventory_days"],
        merchantAction: ["Order units"],
        difficulty: "Easy",
        confidence: 0.9,
        expectedResult: "More stock",
        potentialRisk: "Cash tied up",
        estimatedTime: "1 week",
        businessImpact: "Protect revenue",
        priorityScore: 85,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe("b");
  });
});

describe("Product Intelligence grouping and health explanation", () => {
  it("assigns recommendation groups and health drivers", () => {
    const facts = buildFactsWithHealthScore();
    facts.trend = "declining";
    facts.refundRate = 9;

    const draft = buildValidProductIntelligenceDraft(facts);
    const enriched = enrichProductIntelligenceOutput({ facts, output: draft });
    const groups = buildRecommendationGroups(
      enriched.recommendations.map((recommendation) => ({
        id: recommendation.id,
        group: recommendation.group,
      })),
    );

    expect(enriched.healthExplanation.drivers.length).toBeGreaterThan(0);
    expect(groups.criticalRisks.length + groups.revenueOpportunities.length).toBeGreaterThan(0);
    expect(
      assignRecommendationGroup({
        facts,
        recommendation: draft.recommendations[0],
        impact: estimateRecommendationImpact(facts, draft.recommendations[0]),
        priorityScore: 80,
      }),
    ).toBeDefined();
    expect(buildHealthExplanation(facts).summary).toContain("Health");
  });
});

describe("Product Intelligence lifecycle and expiration", () => {
  it("expires recommendations when inventory is restored", () => {
    const facts = buildFactsWithHealthScore();
    facts.stockRisk = "LOW";
    facts.daysRemaining = 90;

    expect(
      shouldExpireRecommendation({
        facts,
        status: "open",
        payload: { category: "Inventory", verification: { expectedMetric: "Inventory Days" } },
      }),
    ).toBe(true);
    expect(
      getRecommendationExpirationReason({
        facts,
        payload: { category: "Inventory", verification: { expectedMetric: "Inventory Days" } },
      }),
    ).toBe("inventory_restored");
  });

  it("auto-verifies implemented recommendations when metrics improve", async () => {
    const persistence = createInMemoryAIPersistence();
    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "product_intelligence",
        runId: "run-1",
        subjectKey: "product:product-1",
        stableId: "stable-1",
        title: "Increase inventory",
        summary: "Low stock",
        category: "Inventory",
        priority: 1,
        confidence: 0.9,
        payloadJson: {
          id: "inventory-replenishment-plan",
          category: "Inventory",
          verification: {
            expectedMetric: "Inventory Days",
            expectedDirection: "Increase",
            expectedWindow: "14 days",
          },
        },
        status: "implemented",
      },
    ]);

    const facts = buildFactsWithHealthScore();
    facts.daysRemaining = 20;

    const events = await processProductIntelligenceLifecycle({
      storeId: "store-1",
      subjectKey: "product:product-1",
      facts,
      persistence,
    });

    expect(events.some((event) => event.toStatus === "verified")).toBe(true);
  });
});
