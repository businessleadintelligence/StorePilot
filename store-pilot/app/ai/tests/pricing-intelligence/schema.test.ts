import { describe, expect, it } from "vitest";

import {
  PRICING_INTELLIGENCE_CATEGORIES,
  pricingIntelligenceEnrichedSchema,
  pricingIntelligenceSchema,
} from "../../schemas/pricing-intelligence";
import {
  buildPricingIntelligenceFactsFromSnapshot,
  buildValidPricingIntelligenceDraft,
} from "./helpers";
import { mutateAndEnrichPricingIntelligenceOutput } from "../../agents/pricing-intelligence-enrichment";

describe("Pricing Intelligence schema", () => {
  it("accepts a valid draft output", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const draft = buildValidPricingIntelligenceDraft(facts);

    expect(pricingIntelligenceSchema.safeParse(draft).success).toBe(true);
  });

  it("accepts enriched output after deterministic enrichment", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const draft = buildValidPricingIntelligenceDraft(facts);
    const enriched = mutateAndEnrichPricingIntelligenceOutput({ facts, output: draft });

    expect(pricingIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.recommendations[0]?.evidence.length).toBeGreaterThan(0);
    expect(
      Object.values(enriched.recommendationGroups).some((group) => group.length > 0),
    ).toBe(true);
  });

  it("defines all required pricing categories", () => {
    expect(PRICING_INTELLIGENCE_CATEGORIES).toContain("Margin Protection");
    expect(PRICING_INTELLIGENCE_CATEGORIES).toContain("Discount Optimization");
    expect(PRICING_INTELLIGENCE_CATEGORIES).toContain("Premium Pricing");
    expect(PRICING_INTELLIGENCE_CATEGORIES.length).toBe(12);
  });
});
