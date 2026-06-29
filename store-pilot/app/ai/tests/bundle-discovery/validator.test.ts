import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import type { BundleIntelligenceOutput } from "../../schemas/bundle-intelligence";
import { validateBundleDiscoveryBusinessRules } from "../../agents/bundle-discovery.validator";
import {
  buildBundleFactsFromSnapshot,
  buildValidBundleDiscoveryDraft,
} from "./helpers";

describe("Bundle Discovery validator", () => {
  it("rejects health score mismatches", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    output.bundleHealthScore = facts.bundleHealthScore + 5;

    expect(() => validateBundleDiscoveryBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate recommendation ids", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    output.recommendations[1] = {
      ...output.recommendations[0],
      title: "Duplicate starter kit recommendation for Blue Hoodie and Beanie Hat",
    };

    expect(() => validateBundleDiscoveryBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects low-confidence bundles", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    output.recommendations[0].confidence = 0.2;

    expect(() => validateBundleDiscoveryBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects recommendations without evidence keys", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    output.recommendations[0].evidenceKeys = [];

    expect(() => validateBundleDiscoveryBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("enriches valid bundle output in place", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);

    validateBundleDiscoveryBusinessRules(facts, output);

    const enrichedRecommendation = output.recommendations[0] as BundleIntelligenceOutput["recommendations"][number] & {
      evidence?: string[];
      group?: string;
    };

    expect(enrichedRecommendation.evidence?.length).toBeGreaterThan(0);
    expect(enrichedRecommendation.group).toBeTruthy();
    expect(output.healthExplanation?.score).toBe(facts.bundleHealthScore);
  });
});
