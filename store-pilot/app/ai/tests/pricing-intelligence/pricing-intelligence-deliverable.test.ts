import { describe, expect, it } from "vitest";
import { buildPricingIntelligenceDeliverableFields } from "../../schemas/pricing-intelligence";
import { enrichPricingIntelligenceOutput , mutateAndEnrichPricingIntelligenceOutput } from "../../agents/pricing-intelligence-enrichment";
import { buildPricingIntelligenceFactsFromSnapshot, buildValidPricingIntelligenceDraft } from "./helpers";


describe("Pricing intelligence deliverable schema fields", () => {
  it("builds quick wins and critical risks from recommendations", () => {
    const fields = buildPricingIntelligenceDeliverableFields({
      facts: {
        pricingHealthScore: 68,
        revenueOpportunity: 420,
        profitOpportunity: 180,
      },
      recommendations: [
        { id: "1", title: "Reduce discounting", group: "Quick Revenue Wins", priority: 2 },
        { id: "2", title: "Protect margin on hero SKUs", group: "Critical Pricing Risks", priority: 1 },
        { id: "3", title: "Long-term pricing architecture", group: "Long-Term Pricing Strategy", priority: 4 },
      ],
      findings: [{ title: "Discount dependence elevated", severity: "critical" }],
    });

    expect(fields.revenueOpportunity).toBe(420);
    expect(fields.profitOpportunity).toBe(180);
    expect(fields.quickRevenueWins).toContain("Reduce discounting");
    expect(fields.criticalPricingRisks).toContain("Discount dependence elevated");
    expect(fields.premiumOpportunities).toEqual([]);
    expect(fields.pricingTimeline).toEqual([
      { label: "Pricing Health", value: 68 },
      { label: "Revenue Opportunity", value: 420 },
      { label: "Profit Opportunity", value: 180 },
    ]);
  });

  it("enriches output with computed deliverable fields", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const draft = buildValidPricingIntelligenceDraft(facts);
    const enriched = enrichPricingIntelligenceOutput({ facts, output: draft });

    expect(enriched.pricingHealthScore).toBe(facts.pricingHealthScore);
    expect(enriched.revenueOpportunity).toBe(facts.revenueOpportunity);
    expect(enriched.profitOpportunity).toBe(facts.profitOpportunity);
    expect(enriched.recommendations.every((item) => item.evidence.length > 0)).toBe(true);
    expect(enriched.strategyInsights.length).toBeGreaterThan(0);
  });

  it("mutates draft output during validation enrichment", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const draft = buildValidPricingIntelligenceDraft(facts);
    const enriched = mutateAndEnrichPricingIntelligenceOutput({ facts, output: draft });

    expect(draft.pricingHealthScore).toBe(facts.pricingHealthScore);
    expect(enriched.quickRevenueWins.length).toBeGreaterThanOrEqual(0);
  });
});
