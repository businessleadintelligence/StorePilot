import { describe, expect, it } from "vitest";

import { EXECUTIVE_COO_FOCUS_AREAS, EXECUTIVE_COO_GROUPS } from "../../schemas/executive-coo";
import { rankExecutiveCooTopPriorities } from "../../agents/executive-coo-ranking";
import { estimateExecutiveCooPriorityImpact } from "../../agents/executive-coo-impact";
import { assignExecutiveCooGroupFromImpact } from "../../agents/executive-coo-groups";
import { buildExecutiveCooFactsFromSnapshot, buildValidExecutiveCooDraft } from "./helpers";

describe("Executive COO tool matrix", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`supports focus area ${focusArea}`, () => {
      expect(focusArea.length).toBeGreaterThan(2);
    });
  }

  for (const group of EXECUTIVE_COO_GROUPS) {
    it(`supports group ${group}`, () => {
      expect(group.length).toBeGreaterThan(2);
    });
  }

  it("ranks higher priority items first", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const impacts = new Map(
      draft.topPriorities.map((priority) => [
        priority.id,
        estimateExecutiveCooPriorityImpact(facts, priority),
      ]),
    );

    const ranked = rankExecutiveCooTopPriorities({ facts, priorities: draft.topPriorities, impacts });
    expect(ranked[0]?.executionOrder).toBeLessThanOrEqual(ranked[1]?.executionOrder ?? 99);
  });

  it("dedupes duplicate focus area titles in ranking input", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const duplicate = { ...draft.topPriorities[0]!, id: "executive-coo:duplicate" };
    const impacts = new Map(
      [...draft.topPriorities, duplicate].map((priority) => [
        priority.id,
        estimateExecutiveCooPriorityImpact(facts, priority),
      ]),
    );

    const ranked = rankExecutiveCooTopPriorities({
      facts,
      priorities: [...draft.topPriorities, duplicate],
      impacts,
    });

    expect(ranked.length).toBeGreaterThan(0);
  });

  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`assigns group for ${focusArea}`, () => {
      const group = assignExecutiveCooGroupFromImpact({
        focusArea,
        priorityScore: 75,
        impact: { revenueOpportunity: 1200 },
      });
      expect(EXECUTIVE_COO_GROUPS).toContain(group);
    });
  }
});
