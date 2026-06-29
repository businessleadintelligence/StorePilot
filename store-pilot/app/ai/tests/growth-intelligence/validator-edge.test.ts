import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  buildGrowthIntelligenceFactsFromSnapshot,
  buildValidGrowthIntelligenceDraft,
} from "./helpers";
import { validateGrowthIntelligenceBusinessRules } from "../../agents/growth-intelligence.validator";
import { dedupeSimilarGrowthRecommendations } from "../../tools/growth-similarity-tool";
import { buildGrowthRecommendationGroups } from "../../agents/growth-intelligence-groups";
import { estimateGrowthRecommendationImpactForFacts } from "../../agents/growth-intelligence-impact";
import { rankGrowthIntelligenceRecommendations } from "../../agents/growth-intelligence-ranking";
import { buildGrowthIntelligenceHealthExplanation } from "../../agents/growth-intelligence-health";
import { validateGrowthIntelligenceEvidenceKeys } from "../../agents/growth-intelligence-evidence";

describe("Growth Intelligence validator edge cases", () => {
  it("rejects empty recommendations", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);
    output.recommendations = [];

    expect(() => validateGrowthIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown section in findings", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);
    output.findings[0] = {
      ...output.findings[0]!,
      category: "Unknown Section" as never,
    };

    expect(() => validateGrowthIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects implemented recommendations from facts", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    facts.implementedRecommendationIds = ["growth:upsell-campaign"];
    const output = buildValidGrowthIntelligenceDraft(facts);

    expect(() => validateGrowthIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate similar recommendations", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);
    output.recommendations[1] = {
      ...output.recommendations[0]!,
      id: "growth:duplicate-upsell",
    };

    expect(() => validateGrowthIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects growth score mismatch in draft", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);
    output.growthScore = facts.growthScore + 1;

    expect(() => validateGrowthIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });
});

describe("Growth Intelligence enrichment modules", () => {
  it("dedupes similar recommendations before ranking", () => {
    const deduped = dedupeSimilarGrowthRecommendations([
      {
        category: "Upsell",
        title: "Launch upsell on hero products",
        confidence: 0.7,
        priorityScore: 60,
      },
      {
        category: "Upsell",
        title: "Launch upsell on hero products",
        confidence: 0.9,
        priorityScore: 80,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.confidence).toBe(0.9);
  });

  it("builds recommendation groups", () => {
    const groups = buildGrowthRecommendationGroups([
      { id: "a", group: "Immediate Revenue Wins" },
      { id: "b", group: "Retention" },
      { id: "c", group: "Strategic Opportunities" },
    ]);

    expect(groups.immediateRevenueWins).toEqual(["a"]);
    expect(groups.retention).toEqual(["b"]);
    expect(groups.strategicOpportunities).toEqual(["c"]);
  });

  it("estimates impact for retention recommendations", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const recommendation = buildValidGrowthIntelligenceDraft(facts).recommendations.find(
      (item) => item.category === "Retention",
    )!;
    const impact = estimateGrowthRecommendationImpactForFacts(facts, recommendation);

    expect(impact.profitIncrease ?? impact.revenueIncrease ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("ranks recommendations by priority score", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const drafts = buildValidGrowthIntelligenceDraft(facts).recommendations;
    const impacts = new Map(
      drafts.map((draft) => [draft.id, estimateGrowthRecommendationImpactForFacts(facts, draft)]),
    );

    const ranked = rankGrowthIntelligenceRecommendations({
      facts,
      recommendations: drafts,
      impacts,
    });

    expect(ranked[0]?.priorityScore).toBeGreaterThanOrEqual(ranked[1]?.priorityScore ?? 0);
  });

  it("builds health explanation with drivers", async () => {
    const explanation = buildGrowthIntelligenceHealthExplanation(await buildGrowthIntelligenceFactsFromSnapshot());

    expect(explanation.summary.length).toBeGreaterThan(0);
    expect(explanation.drivers.length).toBeGreaterThan(0);
  });

  it("validates evidence keys against catalog", () => {
    const catalog = [
      {
        key: "growth_health_score",
        label: "Growth health score",
        value: "68/100",
        factPath: "growthHealthScore",
        section: "Overview",
      },
    ];

    expect(() => validateGrowthIntelligenceEvidenceKeys(["growth_health_score"], catalog)).not.toThrow();
    expect(() => validateGrowthIntelligenceEvidenceKeys(["missing"], catalog)).toThrow();
  });
});
