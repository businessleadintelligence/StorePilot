import { describe, expect, it } from "vitest";

import {
  SEO_INTELLIGENCE_CATEGORIES,
  seoIntelligenceEnrichedSchema,
  seoIntelligenceSchema,
} from "../../schemas/seo-intelligence";
import {
  buildSeoIntelligenceFactsFromSnapshot,
  buildValidSeoIntelligenceDraft,
} from "./helpers";
import { mutateAndEnrichSeoIntelligenceOutput } from "../../agents/seo-intelligence-enrichment";

describe("SEO Intelligence schema", () => {
  it("accepts a valid draft output", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const draft = buildValidSeoIntelligenceDraft(facts);

    expect(seoIntelligenceSchema.safeParse(draft).success).toBe(true);
  });

  it("accepts enriched output after deterministic enrichment", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const draft = buildValidSeoIntelligenceDraft(facts);
    const enriched = mutateAndEnrichSeoIntelligenceOutput({ facts, output: draft });

    expect(seoIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.recommendations[0]?.evidence.length).toBeGreaterThan(0);
    expect(
      Object.values(enriched.recommendationGroups).some((group) => group.length > 0),
    ).toBe(true);
  });

  it("defines all required SEO categories", () => {
    expect(SEO_INTELLIGENCE_CATEGORIES).toContain("Images");
    expect(SEO_INTELLIGENCE_CATEGORIES).toContain("Technical SEO");
    expect(SEO_INTELLIGENCE_CATEGORIES).toContain("Metadata");
    expect(SEO_INTELLIGENCE_CATEGORIES.length).toBe(15);
  });
});
