import { describe, expect, it } from "vitest";

import {
  BUNDLE_INTELLIGENCE_CATEGORIES,
  BUNDLE_INTELLIGENCE_GROUPS,
  bundleCandidateSchema,
  bundleIntelligenceRecommendationDraftSchema,
} from "../../schemas/bundle-intelligence";
import { getSchemaByName } from "../../schemas";

describe("Bundle intelligence schema", () => {
  it("registers bundle-intelligence in schema registry", () => {
    expect(getSchemaByName("bundle-intelligence")).not.toBeNull();
  });

  it("defines bundle recommendation categories", () => {
    expect(BUNDLE_INTELLIGENCE_CATEGORIES).toContain("Starter Kit");
    expect(BUNDLE_INTELLIGENCE_CATEGORIES).toContain("Dead Inventory Bundle");
  });

  it("defines bundle recommendation groups", () => {
    expect(BUNDLE_INTELLIGENCE_GROUPS).toContain("Top Bundle Opportunities");
    expect(BUNDLE_INTELLIGENCE_GROUPS).toContain("Inventory Recovery Bundles");
  });

  it("validates bundle candidate shape", () => {
    const parsed = bundleCandidateSchema.safeParse({
      id: "bundle:a:b",
      productIds: ["a", "b"],
      titles: ["Product A", "Product B"],
      bundleType: "starter_kit",
      confidence: 0.8,
      attachRate: 0.5,
      complexity: "simple",
      inventoryCompatible: true,
      expectedInventoryReduction: 3,
      potentialAttachRate: 0.55,
    });

    expect(parsed.success).toBe(true);
  });

  it("requires evidence keys on recommendation drafts", () => {
    const parsed = bundleIntelligenceRecommendationDraftSchema.safeParse({
      id: "bundle:a:b",
      category: "Starter Kit",
      title: "Launch Product A + Product B starter kit",
      reason: "Customers frequently purchase these products together in the same order.",
      bundleProductIds: ["a", "b"],
      evidenceKeys: [],
      merchantAction: ["Create a starter kit SKU"],
      estimatedDifficulty: "Easy",
      confidence: 0.8,
      expectedResult: "Increase attach rate",
      potentialRisk: "Margin compression",
      estimatedTime: "2 weeks",
      businessImpact: "Capture existing co-purchase behavior",
    });

    expect(parsed.success).toBe(false);
  });
});
