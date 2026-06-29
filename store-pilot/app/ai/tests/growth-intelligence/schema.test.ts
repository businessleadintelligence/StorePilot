import { describe, expect, it } from "vitest";

import {
  GROWTH_INTELLIGENCE_CATEGORIES,
  growthIntelligenceEnrichedSchema,
  growthIntelligenceSchema,
} from "../../schemas/growth-intelligence";
import {
  buildGrowthIntelligenceFactsFromSnapshot,
  buildValidGrowthIntelligenceDraft,
} from "./helpers";
import { mutateAndEnrichGrowthIntelligenceOutput } from "../../agents/growth-intelligence-enrichment";

describe("Growth Intelligence schema", () => {
  it("accepts a valid draft output", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const draft = buildValidGrowthIntelligenceDraft(facts);

    expect(growthIntelligenceSchema.safeParse(draft).success).toBe(true);
  });

  it("accepts enriched output after deterministic enrichment", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const draft = buildValidGrowthIntelligenceDraft(facts);
    const enriched = mutateAndEnrichGrowthIntelligenceOutput({ facts, output: draft });

    expect(growthIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.recommendations[0]?.evidence.length).toBeGreaterThan(0);
    expect(
      Object.values(enriched.recommendationGroups).some((group) => group.length > 0),
    ).toBe(true);
  });

  it("defines all required growth categories", () => {
    expect(GROWTH_INTELLIGENCE_CATEGORIES).toContain("Revenue Growth");
    expect(GROWTH_INTELLIGENCE_CATEGORIES).toContain("Upsell");
    expect(GROWTH_INTELLIGENCE_CATEGORIES).toContain("Retention");
    expect(GROWTH_INTELLIGENCE_CATEGORIES.length).toBe(12);
  });
});
