import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  buildPricingIntelligenceFactsFromSnapshot,
  buildValidPricingIntelligenceDraft,
} from "./helpers";
import { validatePricingIntelligenceBusinessRules } from "../../agents/pricing-intelligence.validator";
import { dedupeSimilarPricingRecommendations } from "../../tools/pricing-similarity-tool";
import { buildPricingRecommendationGroups } from "../../agents/pricing-intelligence-groups";
import { estimatePricingRecommendationImpactForFacts } from "../../agents/pricing-intelligence-impact";
import { rankPricingIntelligenceRecommendations } from "../../agents/pricing-intelligence-ranking";
import { buildPricingIntelligenceHealthExplanation } from "../../agents/pricing-intelligence-health";
import { validatePricingIntelligenceEvidenceKeys } from "../../agents/pricing-intelligence-evidence";

describe("Pricing Intelligence validator edge cases", () => {
  it("rejects empty recommendations", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);
    output.recommendations = [];

    expect(() => validatePricingIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown section in findings", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);
    output.findings[0] = {
      ...output.findings[0]!,
      category: "Unknown Section" as never,
    };

    expect(() => validatePricingIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects implemented recommendations from facts", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    facts.implementedRecommendationIds = ["pricing:discount-discipline"];
    const output = buildValidPricingIntelligenceDraft(facts);

    expect(() => validatePricingIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate similar recommendations", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);
    output.recommendations[1] = {
      ...output.recommendations[0]!,
      id: "pricing:duplicate-discount",
    };

    expect(() => validatePricingIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects pricing health score mismatch in draft", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);
    output.pricingHealthScore = facts.pricingHealthScore + 1;

    expect(() => validatePricingIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });
});

describe("Pricing Intelligence enrichment modules", () => {
  it("dedupes similar recommendations before ranking", () => {
    const deduped = dedupeSimilarPricingRecommendations([
      {
        category: "Discount Optimization",
        title: "Reduce blanket discounting",
        confidence: 0.7,
        priorityScore: 60,
      },
      {
        category: "Discount Optimization",
        title: "Reduce blanket discounting",
        confidence: 0.9,
        priorityScore: 80,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.confidence).toBe(0.9);
  });

  it("builds recommendation groups", () => {
    const groups = buildPricingRecommendationGroups([
      { id: "a", group: "Critical Pricing Risks" },
      { id: "b", group: "Premium Pricing" },
      { id: "c", group: "Quick Revenue Wins" },
    ]);

    expect(groups.criticalPricingRisks).toEqual(["a"]);
    expect(groups.premiumPricing).toEqual(["b"]);
    expect(groups.quickRevenueWins).toEqual(["c"]);
  });

  it("estimates impact for discount recommendations", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const recommendation = buildValidPricingIntelligenceDraft(facts).recommendations.find(
      (item) => item.category === "Discount Optimization",
    )!;
    const impact = estimatePricingRecommendationImpactForFacts(facts, recommendation);

    expect(impact.profitIncrease ?? impact.revenueIncrease ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("ranks recommendations by priority score", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const drafts = buildValidPricingIntelligenceDraft(facts).recommendations;
    const impacts = new Map(
      drafts.map((draft) => [draft.id, estimatePricingRecommendationImpactForFacts(facts, draft)]),
    );

    const ranked = rankPricingIntelligenceRecommendations({
      facts,
      recommendations: drafts,
      impacts,
    });

    expect(ranked[0]?.priorityScore).toBeGreaterThanOrEqual(ranked[1]?.priorityScore ?? 0);
  });

  it("builds health explanation with drivers", async () => {
    const explanation = buildPricingIntelligenceHealthExplanation(await buildPricingIntelligenceFactsFromSnapshot());

    expect(explanation.summary.length).toBeGreaterThan(0);
    expect(explanation.drivers.length).toBeGreaterThan(0);
  });

  it("validates evidence keys against catalog", () => {
    const catalog = [
      {
        key: "pricing_health_score",
        label: "Pricing health score",
        value: "68/100",
        factPath: "pricingHealthScore",
        section: "Overview",
      },
    ];

    expect(() => validatePricingIntelligenceEvidenceKeys(["pricing_health_score"], catalog)).not.toThrow();
    expect(() => validatePricingIntelligenceEvidenceKeys(["missing"], catalog)).toThrow();
  });
});
