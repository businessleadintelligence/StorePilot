import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  buildSeoIntelligenceFactsFromSnapshot,
  buildValidSeoIntelligenceDraft,
  createMockSeoIntelligenceSnapshot,
} from "./helpers";
import { createSeoIntelligenceFactsBuilder } from "../../facts/seo-intelligence-facts";
import {
  isVagueSeoRecommendationText,
  validateSeoIntelligenceBusinessRules,
} from "../../agents/seo-intelligence.validator";
import { mutateAndEnrichSeoIntelligenceOutput } from "../../agents/seo-intelligence-enrichment";

describe("SEO Intelligence validator", () => {
  it("rejects health score mismatch", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);
    output.seoHealthScore = facts.seoHealthScore + 5;

    expect(() => validateSeoIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate recommendation ids", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);
    output.recommendations[1] = { ...output.recommendations[0]! };

    expect(() => validateSeoIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown evidence keys", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);
    output.recommendations[0]!.evidenceKeys = ["unknown_evidence_key"];

    expect(() => validateSeoIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects vague recommendations", () => {
    expect(isVagueSeoRecommendationText("improve seo")).toBe(true);
  });

  it("enriches valid output in-place", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);

    validateSeoIntelligenceBusinessRules(facts, output);

    const enrichedRecommendation = output.recommendations[0] as typeof output.recommendations[number] & {
      evidence?: string[];
    };
    expect(output.healthExplanation?.score).toBe(facts.seoHealthScore);
    expect(enrichedRecommendation.evidence?.length).toBeGreaterThan(0);
  });

  it("mutates enriched recommendations with groups and verification", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);
    const enriched = mutateAndEnrichSeoIntelligenceOutput({ facts, output });

    expect(enriched.recommendations[0]?.group).toBeTruthy();
    expect(enriched.recommendations[0]?.verification.expectedMetric).toBeTruthy();
  });

  it("validates builder-backed draft output", async () => {
    const snapshot = createMockSeoIntelligenceSnapshot();
    const builder = createSeoIntelligenceFactsBuilder({
      async getSeoIntelligenceSnapshot() {
        return snapshot;
      },
    });
    const facts = await builder.build({ storeId: "store-1", agentId: "seo_audit" });
    const output = buildValidSeoIntelligenceDraft(facts);

    validateSeoIntelligenceBusinessRules(facts, output);
  });
});
