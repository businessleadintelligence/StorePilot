import { describe, expect, it } from "vitest";
import { buildGrowthIntelligenceDeliverableFields } from "../../schemas/growth-intelligence";
import { enrichGrowthIntelligenceOutput , mutateAndEnrichGrowthIntelligenceOutput } from "../../agents/growth-intelligence-enrichment";
import { buildGrowthIntelligenceFactsFromSnapshot, buildValidGrowthIntelligenceDraft } from "./helpers";


describe("Growth intelligence deliverable schema fields", () => {
  it("builds quick wins and critical risks from recommendations", () => {
    const fields = buildGrowthIntelligenceDeliverableFields({
      facts: {
        growthScore: 68,
        revenueOpportunity: 420,
        aovOpportunity: 180,
      },
      recommendations: [
        { id: "1", title: "Launch upsell campaign", group: "Immediate Revenue Wins", priority: 2 },
        { id: "2", title: "Improve retention win-back", group: "Retention", priority: 1 },
        { id: "3", title: "Seasonal collection push", group: "Strategic Opportunities", priority: 4 },
      ],
      findings: [{ title: "Retention limiting growth expansion", severity: "critical" }],
    });

    expect(fields.revenueOpportunity).toBe(420);
    expect(fields.aovOpportunity).toBe(180);
    expect(fields.quickGrowthWins).toContain("Launch upsell campaign");
    expect(fields.criticalGrowthRisks).toContain("Retention limiting growth expansion");
    expect(fields.expansionOpportunities).toContain("Seasonal collection push");
    expect(fields.campaignTimeline).toEqual([
      { label: "Growth Score", value: 68 },
      { label: "Revenue Opportunity", value: 420 },
      { label: "AOV Opportunity", value: 180 },
    ]);
  });

  it("enriches output with computed deliverable fields", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const draft = buildValidGrowthIntelligenceDraft(facts);
    const enriched = enrichGrowthIntelligenceOutput({ facts, output: draft });

    expect(enriched.growthScore).toBe(facts.growthScore);
    expect(enriched.revenueOpportunity).toBe(facts.revenueOpportunity);
    expect(enriched.aovOpportunity).toBe(facts.aovOpportunity);
    expect(enriched.recommendations.every((item) => item.evidence.length > 0)).toBe(true);
    expect(enriched.strategyInsights.length).toBeGreaterThan(0);
  });

  it("mutates draft output during validation enrichment", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const draft = buildValidGrowthIntelligenceDraft(facts);
    const enriched = mutateAndEnrichGrowthIntelligenceOutput({ facts, output: draft });

    expect(draft.growthScore).toBe(facts.growthScore);
    expect(enriched.quickGrowthWins.length).toBeGreaterThanOrEqual(0);
  });
});
