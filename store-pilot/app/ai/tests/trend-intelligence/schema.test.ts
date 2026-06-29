import { describe, expect, it } from "vitest";
import { trendIntelligenceEnrichedSchema, trendIntelligenceSchema, TREND_INTELLIGENCE_CATEGORIES } from "../../schemas/trend-intelligence";
import { buildTrendFactsFromSnapshot, buildValidTrendIntelligenceDraft } from "./helpers";
import { mutateAndEnrichTrendIntelligenceOutput } from "../../agents/trend-intelligence-enrichment";

describe("Trend Intelligence schema", () => {
  it("accepts valid draft output", () => {
    const facts = buildTrendFactsFromSnapshot();
    expect(storeAuditSchemaSafeParse(buildValidTrendIntelligenceDraft(facts))).toBe(true);
  });

  it("accepts enriched output", () => {
    const facts = buildTrendFactsFromSnapshot();
    const draft = buildValidTrendIntelligenceDraft(facts);
    const enriched = mutateAndEnrichTrendIntelligenceOutput({ facts, output: draft });
    expect(trendIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
  });

  it("defines required categories", () => {
    expect(TREND_INTELLIGENCE_CATEGORIES).toContain("Emerging Opportunity");
    expect(TREND_INTELLIGENCE_CATEGORIES.length).toBe(8);
  });
});

function storeAuditSchemaSafeParse(output: ReturnType<typeof buildValidTrendIntelligenceDraft>) {
  return trendIntelligenceSchema.safeParse(output).success;
}
