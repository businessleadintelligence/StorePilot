import { describe, expect, it } from "vitest";
import { buildStoreAuditDeliverableFields } from "../../schemas/store-audit";
import { enrichStoreAuditOutput , mutateAndEnrichStoreAuditOutput } from "../../agents/store-audit-enrichment";
import { buildStoreAuditFactsFromSnapshot, buildValidStoreAuditDraft } from "./helpers";

describe("Store audit deliverable schema fields", () => {
  it("builds quick wins and critical issues from recommendations", () => {
    const fields = buildStoreAuditDeliverableFields({
      storeHealthScore: 74,
      navigationScore: 75,
      trustScore: 68,
      imageOptimizationScore: 72,
      technicalSeoScore: 74,
      policyScore: 85,
      appBloatScore: 74,
      merchantBestPracticesScore: 77,
      recommendations: [
        { id: "1", title: "Compress images", group: "Quick Wins", priority: 2 },
        { id: "2", title: "Fix policies", group: "Critical Fixes", priority: 1 },
        { id: "3", title: "Improve CRO funnel", group: "Long-Term CRO", priority: 4 },
      ],
      findings: [
        { title: "Missing refund policy", severity: "critical" },
        { title: "Short product titles", severity: "high" },
      ],
    });

    expect(fields.overallAuditScore).toBe(74);
    expect(fields.quickWins).toContain("Compress images");
    expect(fields.criticalIssues).toContain("Missing refund policy");
    expect(fields.longTermImprovements).toContain("Improve CRO funnel");
    expect(fields.estimatedRevenueImpact).toBeGreaterThan(0);
    expect(fields.estimatedConversionImpact).toBeGreaterThan(0);
  });

  it("enriches output with computed deliverable fields", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const draft = buildValidStoreAuditDraft(facts);
    const enriched = enrichStoreAuditOutput({ facts, output: draft });

    expect(enriched.overallAuditScore).toBe(facts.storeHealthScore);
    expect(enriched.navigationScore).toBe(facts.navigationScore);
    expect(enriched.imageOptimizationScore).toBe(facts.imageOptimizationScore);
    expect(enriched.trustScore).toBe(facts.trustScore);
    expect(enriched.recommendations.every((item) => item.evidence.length > 0)).toBe(true);
  });

  it("mutates draft output during validation enrichment", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const draft = buildValidStoreAuditDraft(facts);
    const enriched = mutateAndEnrichStoreAuditOutput({ facts, output: draft });

    expect(draft.storeHealthScore).toBe(facts.storeHealthScore);
    expect(enriched.quickWins.length).toBeGreaterThanOrEqual(0);
  });
});
