import { describe, expect, it } from "vitest";

import { buildExecutiveCooDeliverableFields } from "../../schemas/executive-coo";
import { mutateAndEnrichExecutiveCooOutput } from "../../agents/executive-coo-enrichment";
import { validateExecutiveCooBusinessRules } from "../../agents/executive-coo.validator";
import {
  buildExecutiveCooFactsFromSnapshot,
  buildValidExecutiveCooDraft,
} from "./helpers";

describe("Executive COO deliverable schema fields", () => {
  it("builds quick wins and critical risks from priorities", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const deliverable = buildExecutiveCooDeliverableFields({
      facts: {
        operationsHealthScore: facts.operationsHealthScore,
        revenueOpportunity: facts.revenueOpportunity,
        inventoryRisk: facts.inventoryRisk,
      },
      topPriorities: [
        { id: "executive-coo:quick", title: "Quick inventory fix", group: "Quick Wins", priority: 2 },
        { id: "executive-coo:critical", title: "Critical stockout risk", group: "Critical Operations", priority: 1 },
      ],
      findings: [{ title: "Inventory risk elevated", severity: "critical" }],
    });

    expect(deliverable.quickOperationalWins.length).toBeGreaterThan(0);
    expect(deliverable.criticalOperationalRisks.length).toBeGreaterThan(0);
    expect(deliverable.operationsTimeline.length).toBeGreaterThan(0);
  });

  it("enriches output with computed deliverable fields", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const enriched = mutateAndEnrichExecutiveCooOutput({ facts, output: draft });

    expect(enriched.revenueOpportunity).toBe(facts.revenueOpportunity);
    expect(enriched.inventoryRisk).toBe(facts.inventoryRisk);
    expect(enriched.topPriorities[0]?.evidence.length).toBeGreaterThan(0);
  });

  it("mutates draft output during validation enrichment", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);

    expect(() => validateExecutiveCooBusinessRules(facts, draft)).not.toThrow();
    expect(draft.topPriorities[0]?.evidenceKeys.length).toBeGreaterThan(0);
  });
});
