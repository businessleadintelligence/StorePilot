import { describe, expect, it } from "vitest";

import { buildExecutiveCooEvidenceCatalog, sectionScoreForFocusArea } from "../../agents/executive-coo-evidence";
import { estimateExecutiveCooPriorityImpact } from "../../agents/executive-coo-impact";
import { assignExecutiveCooGroupFromImpact } from "../../agents/executive-coo-groups";
import { buildExecutiveCooFactsFromSnapshot, buildValidExecutiveCooDraft } from "./helpers";

describe("Executive COO tools and facts", () => {
  it("builds evidence catalog from persisted facts", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const catalog = buildExecutiveCooEvidenceCatalog(facts);
    expect(catalog.length).toBeGreaterThan(5);
  });

  it("scores focus areas from facts", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    expect(sectionScoreForFocusArea(facts, "Inventory")).toBeGreaterThanOrEqual(0);
    expect(sectionScoreForFocusArea(facts, "Revenue")).toBeGreaterThanOrEqual(0);
  });

  it("estimates priority impact", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const impact = estimateExecutiveCooPriorityImpact(facts, draft.topPriorities[0]!);
    expect(impact.revenueOpportunity ?? impact.ordersProtected ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("assigns executive groups from impact", () => {
    const group = assignExecutiveCooGroupFromImpact({
      focusArea: "Inventory",
      priorityScore: 80,
      impact: { inventoryReduction: 10 },
    });
    expect(group).toBe("Inventory Stabilization");
  });

  it("includes growth score on facts snapshot", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    expect(facts.growthScore).toBeGreaterThan(0);
    expect(facts.operationsHealthScore).toBeGreaterThan(0);
  });
});
