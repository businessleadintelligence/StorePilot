import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  isVagueBundleRecommendationText,
  validateBundleDiscoveryBusinessRules,
} from "../../agents/bundle-discovery.validator";
import { validateBundleEvidenceKeys } from "../../agents/bundle-discovery-evidence";
import { buildBundleEvidenceCatalog } from "../../agents/bundle-discovery-evidence";
import { classifyBundleHealthBand } from "../../tools/bundle-health-tool";
import { passesBundleSafetyConstraints } from "../../tools/bundle-impact-tool";
import {
  buildBundleFactsFromSnapshot,
  buildValidBundleDiscoveryDraft,
} from "./helpers";

describe("Bundle Discovery validator edge cases", () => {
  it("rejects invalid bundle combinations", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    output.recommendations[0].bundleProductIds = ["unknown-product"];

    expect(() => validateBundleDiscoveryBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects products already bundled", () => {
    const facts = buildBundleFactsFromSnapshot();
    facts.implementedBundleIds = ["bundle:product-1:product-2"];
    const output = buildValidBundleDiscoveryDraft(facts);

    expect(() => validateBundleDiscoveryBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects contradictory dead inventory recommendations", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    output.recommendations[0].category = "Dead Inventory Bundle";

    expect(() => validateBundleDiscoveryBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects vague bundle recommendation text", () => {
    expect(isVagueBundleRecommendationText("create a bundle")).toBe(true);
    expect(isVagueBundleRecommendationText("Launch Blue Hoodie + Beanie starter kit")).toBe(false);
  });

  it("rejects invalid evidence keys", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    output.recommendations[0].evidenceKeys = ["missing_key"];

    expect(() => validateBundleDiscoveryBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("validates evidence keys against catalog", () => {
    const facts = buildBundleFactsFromSnapshot();
    const catalog = buildBundleEvidenceCatalog(facts);

    expect(() => validateBundleEvidenceKeys(["bundle_health_score"], catalog)).not.toThrow();
    expect(() => validateBundleEvidenceKeys(["missing_key"], catalog)).toThrow();
  });

  it("classifies bundle health bands", () => {
    expect(classifyBundleHealthBand(85)).toBe("strong");
    expect(classifyBundleHealthBand(65)).toBe("watch");
    expect(classifyBundleHealthBand(40)).toBe("weak");
  });

  it("enforces bundle safety constraints", () => {
    expect(
      passesBundleSafetyConstraints({
        productCount: 2,
        inventoryCompatible: true,
        confidence: 0.7,
      }),
    ).toBe(true);
    expect(
      passesBundleSafetyConstraints({
        productCount: 5,
        inventoryCompatible: true,
        confidence: 0.7,
      }),
    ).toBe(false);
  });
});
