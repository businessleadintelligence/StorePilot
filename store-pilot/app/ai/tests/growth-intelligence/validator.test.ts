import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  buildGrowthIntelligenceFactsFromSnapshot,
  buildValidGrowthIntelligenceDraft,
} from "./helpers";
import {
  isVagueGrowthRecommendationText,
  validateGrowthIntelligenceBusinessRules,
} from "../../agents/growth-intelligence.validator";
import { mutateAndEnrichGrowthIntelligenceOutput } from "../../agents/growth-intelligence-enrichment";
import { createGrowthIntelligenceFactsBuilder } from "../../facts/growth-intelligence-facts";
import { createMockGrowthIntelligenceSnapshot } from "./helpers";

describe("Growth Intelligence validator", () => {
  it("rejects health score mismatch", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);
    output.growthScore = facts.growthScore + 5;

    expect(() => validateGrowthIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate recommendation ids", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);
    output.recommendations[1] = { ...output.recommendations[0]! };

    expect(() => validateGrowthIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown evidence keys", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);
    output.recommendations[0]!.evidenceKeys = ["unknown_evidence_key"];

    expect(() => validateGrowthIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects vague recommendations", () => {
    expect(isVagueGrowthRecommendationText("grow revenue")).toBe(true);
  });

  it("enriches valid output in-place", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);

    validateGrowthIntelligenceBusinessRules(facts, output);

    const enrichedRecommendation = output.recommendations[0] as typeof output.recommendations[number] & {
      evidence?: string[];
    };
    expect(output.healthExplanation?.score).toBe(facts.growthHealthScore);
    expect(enrichedRecommendation.evidence?.length).toBeGreaterThan(0);
  });

  it("mutates enriched recommendations with groups and verification", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);
    const enriched = mutateAndEnrichGrowthIntelligenceOutput({ facts, output });

    expect(enriched.recommendations[0]?.group).toBeTruthy();
    expect(enriched.recommendations[0]?.verification.expectedMetric).toBeTruthy();
  });

  it("validates builder-backed draft output", async () => {
    const snapshot = createMockGrowthIntelligenceSnapshot();
    const builder = createGrowthIntelligenceFactsBuilder({
      async getGrowthIntelligenceSnapshot() {
        return snapshot;
      },
    });
    const facts = await builder.build({ storeId: "store-1", agentId: "growth_intelligence" });
    const output = buildValidGrowthIntelligenceDraft(facts);

    validateGrowthIntelligenceBusinessRules(facts, output);
  });
});
