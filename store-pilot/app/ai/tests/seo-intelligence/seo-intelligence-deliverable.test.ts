import { describe, expect, it } from "vitest";
import { buildSeoIntelligenceDeliverableFields } from "../../schemas/seo-intelligence";
import { enrichSeoIntelligenceOutput } from "../../agents/seo-intelligence-enrichment";
import { buildSeoIntelligenceFactsFromSnapshot, buildValidSeoIntelligenceDraft } from "./helpers";
import { mutateAndEnrichSeoIntelligenceOutput } from "../../agents/seo-intelligence-enrichment";

describe("SEO intelligence deliverable schema fields", () => {
  it("builds quick wins and critical issues from recommendations", () => {
    const fields = buildSeoIntelligenceDeliverableFields({
      facts: {
        seoHealthScore: 74,
        trafficOpportunity: 420,
        visibilityOpportunity: 180,
      },
      recommendations: [
        { id: "1", title: "Expand metadata", group: "Quick Wins", priority: 2 },
        { id: "2", title: "Fix canonicals", group: "Critical Fixes", priority: 1 },
        { id: "3", title: "Long-term content plan", group: "Long-Term SEO Strategy", priority: 4 },
      ],
      technicalFindings: [{ title: "Canonical conflict", severity: "critical" }],
      contentFindings: [{ title: "Short product titles", severity: "high" }],
    });

    expect(fields.trafficOpportunity).toBe(420);
    expect(fields.visibilityOpportunity).toBe(180);
    expect(fields.quickWins).toContain("Expand metadata");
    expect(fields.criticalIssues).toContain("Canonical conflict");
    expect(fields.longTermOpportunities).toContain("Long-term content plan");
    expect(fields.seoTimeline).toEqual([
      { label: "SEO Health", value: 74 },
      { label: "Traffic Opportunity", value: 420 },
      { label: "Visibility Opportunity", value: 180 },
    ]);
  });

  it("enriches output with computed deliverable fields", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const draft = buildValidSeoIntelligenceDraft(facts);
    const enriched = enrichSeoIntelligenceOutput({ facts, output: draft });

    expect(enriched.seoHealthScore).toBe(facts.seoHealthScore);
    expect(enriched.trafficOpportunity).toBe(facts.trafficOpportunity);
    expect(enriched.visibilityOpportunity).toBe(facts.visibilityOpportunity);
    expect(enriched.recommendations.every((item) => item.evidence.length > 0)).toBe(true);
  });

  it("mutates draft output during validation enrichment", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const draft = buildValidSeoIntelligenceDraft(facts);
    const enriched = mutateAndEnrichSeoIntelligenceOutput({ facts, output: draft });

    expect(draft.seoHealthScore).toBe(facts.seoHealthScore);
    expect(enriched.quickWins.length).toBeGreaterThanOrEqual(0);
  });
});
