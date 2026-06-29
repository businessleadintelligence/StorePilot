import { describe, expect, it } from "vitest";
import { AIPlatformError } from "../../core/ai-errors";
import { createTrendFactsBuilder } from "../../facts/trend-facts";
import {
  isVagueTrendRecommendationText,
  validateTrendIntelligenceBusinessRules,
} from "../../agents/trend-intelligence.validator";
import { mutateAndEnrichTrendIntelligenceOutput } from "../../agents/trend-intelligence-enrichment";
import {
  buildTrendFactsFromSnapshot,
  buildValidTrendIntelligenceDraft,
  createMockTrendSnapshot,
} from "./helpers";

describe("Trend Intelligence validator", () => {
  it("rejects health score mismatch", () => {
    const facts = buildTrendFactsFromSnapshot();
    const output = buildValidTrendIntelligenceDraft(facts);
    output.trendHealthScore = facts.trendHealthScore + 5;
    expect(() => validateTrendIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects trend direction mismatch", () => {
    const facts = buildTrendFactsFromSnapshot();
    const output = buildValidTrendIntelligenceDraft(facts);
    output.trendDirection = "stable";
    expect(() => validateTrendIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown evidence keys", () => {
    const facts = buildTrendFactsFromSnapshot();
    const output = buildValidTrendIntelligenceDraft(facts);
    output.recommendations[0]!.evidenceKeys = ["unknown_key"];
    expect(() => validateTrendIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects vague recommendations", () => {
    expect(isVagueTrendRecommendationText("watch trends")).toBe(true);
  });

  it("enriches valid output in-place", () => {
    const facts = buildTrendFactsFromSnapshot();
    const output = buildValidTrendIntelligenceDraft(facts);
    validateTrendIntelligenceBusinessRules(facts, output);
    expect(output.healthExplanation?.score).toBe(facts.trendHealthScore);
  });

  it("validates builder-backed draft output", async () => {
    const snapshot = createMockTrendSnapshot();
    const facts = await createTrendFactsBuilder({
      async getStoreTrendSnapshot() {
        return snapshot;
      },
    }).build({ storeId: "store-1" });
    const output = buildValidTrendIntelligenceDraft({
      trendHealthScore: facts.trendHealthScore,
      trendDirection: facts.trendDirection,
      products: facts.products,
      emergingProductIds: facts.emergingProductIds,
      decliningProductIds: facts.decliningProductIds,
      seasonalSignals: facts.seasonalSignals,
    });
    validateTrendIntelligenceBusinessRules(facts, output);
  });

  it("mutates enriched recommendations", () => {
    const facts = buildTrendFactsFromSnapshot();
    const output = buildValidTrendIntelligenceDraft(facts);
    const enriched = mutateAndEnrichTrendIntelligenceOutput({ facts, output });
    expect(enriched.recommendations[0]?.group).toBeTruthy();
    expect(enriched.recommendations[0]?.verification.expectedMetric).toBeTruthy();
  });
});
