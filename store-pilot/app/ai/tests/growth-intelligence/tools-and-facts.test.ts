import { describe, expect, it } from "vitest";

import { analyzeGrowthRetention, analyzeGrowthUpsell } from "../../tools/growth-section-tool";
import { calculateGrowthIntelligenceHealthScore } from "../../tools/growth-health-tool";
import { estimateGrowthImpact } from "../../tools/growth-impact-tool";
import { assignGrowthRecommendationGroup } from "../../tools/growth-group-tool";
import { calculateGrowthPriorityScore } from "../../tools/growth-ranking-tool";
import { dedupeSimilarGrowthRecommendations } from "../../tools/growth-similarity-tool";
import { analyzeGrowthRisk } from "../../tools/growth-risk-tool";
import { createGrowthIntelligenceFactsBuilder } from "../../facts/growth-intelligence-facts";
import { buildGrowthIntelligenceEvidenceCatalog } from "../../agents/growth-intelligence-evidence";
import {
  buildMockGrowthScores,
  buildGrowthIntelligenceFactsFromSnapshot,
  createMockGrowthIntelligenceSnapshot,
} from "./helpers";

describe("Growth intelligence deterministic tools", () => {
  it("flags retention gaps from low repeat proxy", () => {
    const result = analyzeGrowthRetention({
      repeatOrderProxy: 10,
      refundRate: 9,
    });

    expect(result.issues).toContain("weak_repeat_purchase");
    expect(result.score).toBeLessThan(50);
  });

  it("flags weak upsell attach from low attach rate", () => {
    const result = analyzeGrowthUpsell({
      aov: 42,
      attachRateProxy: 0.08,
      fastMoverCount: 1,
    });

    expect(result.issues).toContain("weak_upsell_attach");
    expect(result.score).toBeLessThan(80);
  });

  it("estimates growth impact by category", () => {
    const impact = estimateGrowthImpact({
      category: "Revenue Growth",
      confidence: 0.8,
      sectionScore: 55,
    });

    expect(impact.revenueIncrease).toBeGreaterThan(0);
  });

  it("assigns recommendation groups", () => {
    expect(
      assignGrowthRecommendationGroup({
        category: "Retention",
        priorityScore: 50,
        hasDeterministicImpact: false,
      }),
    ).toBe("Retention");
  });

  it("dedupes similar recommendations", () => {
    const deduped = dedupeSimilarGrowthRecommendations([
      { category: "Upsell", title: "Launch upsell on hero products", confidence: 0.7, priorityScore: 60 },
      { category: "Upsell", title: "Launch upsell on hero products", confidence: 0.9, priorityScore: 80 },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.confidence).toBe(0.9);
  });

  it("builds facts from snapshot source", async () => {
    const snapshot = createMockGrowthIntelligenceSnapshot();
    const builder = createGrowthIntelligenceFactsBuilder({
      async getGrowthIntelligenceSnapshot() {
        return snapshot;
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "growth_intelligence" });

    expect(facts.growthHealthScore).toBeGreaterThan(0);
    expect(facts.scores.growthScore).toBeGreaterThan(0);
    expect(facts.retention.retentionScore).toBeGreaterThan(0);
    expect(facts.upsell.upsellOpportunity).toBeGreaterThan(0);
  });

  it("builds evidence catalog from facts", async () => {
    const catalog = buildGrowthIntelligenceEvidenceCatalog(await buildGrowthIntelligenceFactsFromSnapshot());

    expect(catalog.some((entry) => entry.key === "growth_health_score")).toBe(true);
    expect(catalog.some((entry) => entry.key === "growth_score")).toBe(true);
  });

  it("calculates composite health score", () => {
    const score = calculateGrowthIntelligenceHealthScore({
      scores: buildMockGrowthScores({
        growthHealthScore: 76,
        retentionScore: 38,
        upsellOpportunity: 42,
      }),
      criticalIssueCount: 3,
    });

    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("audits growth risk composite", () => {
    expect(
      analyzeGrowthRisk({
        revenueGrowthRate: -15,
        retentionScore: 30,
        growthRiskFromInventory: 45,
        growthRiskFromPricing: 35,
        refundRate: 9,
      }).issues.length,
    ).toBeGreaterThan(0);
  });

  it("ranks growth recommendations by priority score", () => {
    const high = calculateGrowthPriorityScore({
      confidence: 0.95,
      difficultyWeight: 1,
      impact: { revenueIncrease: 8, profitIncrease: 5, aovLift: 0.05, retentionLift: 0.1 },
      sectionScore: 40,
    });
    const low = calculateGrowthPriorityScore({
      confidence: 0.2,
      difficultyWeight: 0.85,
      impact: { revenueIncrease: null, profitIncrease: null, aovLift: null, retentionLift: null },
      sectionScore: 85,
    });

    expect(high).toBeGreaterThan(low);
  });
});
