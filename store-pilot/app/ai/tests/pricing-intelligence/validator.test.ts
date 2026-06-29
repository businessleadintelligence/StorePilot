import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  buildPricingIntelligenceFactsFromSnapshot,
  buildValidPricingIntelligenceDraft,
  createMockPricingIntelligenceSnapshot,
} from "./helpers";
import { createPricingIntelligenceFactsBuilder } from "../../facts/pricing-intelligence-facts";
import {
  isVaguePricingRecommendationText,
  validatePricingIntelligenceBusinessRules,
} from "../../agents/pricing-intelligence.validator";
import { mutateAndEnrichPricingIntelligenceOutput } from "../../agents/pricing-intelligence-enrichment";

describe("Pricing Intelligence validator", () => {
  it("rejects health score mismatch", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);
    output.pricingHealthScore = facts.pricingHealthScore + 5;

    expect(() => validatePricingIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate recommendation ids", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);
    output.recommendations[1] = { ...output.recommendations[0]! };

    expect(() => validatePricingIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown evidence keys", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);
    output.recommendations[0]!.evidenceKeys = ["unknown_evidence_key"];

    expect(() => validatePricingIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects vague recommendations", () => {
    expect(isVaguePricingRecommendationText("improve pricing")).toBe(true);
  });

  it("enriches valid output in-place", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);

    validatePricingIntelligenceBusinessRules(facts, output);

    const enrichedRecommendation = output.recommendations[0] as typeof output.recommendations[number] & {
      evidence?: string[];
    };
    expect(output.healthExplanation?.score).toBe(facts.pricingHealthScore);
    expect(enrichedRecommendation.evidence?.length).toBeGreaterThan(0);
  });

  it("mutates enriched recommendations with groups and verification", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);
    const enriched = mutateAndEnrichPricingIntelligenceOutput({ facts, output });

    expect(enriched.recommendations[0]?.group).toBeTruthy();
    expect(enriched.recommendations[0]?.verification.expectedMetric).toBeTruthy();
  });

  it("validates builder-backed draft output", async () => {
    const snapshot = createMockPricingIntelligenceSnapshot();
    const builder = createPricingIntelligenceFactsBuilder({
      async getPricingIntelligenceSnapshot() {
        return snapshot;
      },
    });
    const facts = await builder.build({ storeId: "store-1", agentId: "pricing_intelligence" });
    const output = buildValidPricingIntelligenceDraft(facts);

    validatePricingIntelligenceBusinessRules(facts, output);
  });
});
