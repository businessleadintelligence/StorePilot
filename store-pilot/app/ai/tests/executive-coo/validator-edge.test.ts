import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import { validateExecutiveCooBusinessRules } from "../../agents/executive-coo.validator";
import { estimateExecutiveCooPriorityImpact } from "../../agents/executive-coo-impact";
import { rankExecutiveCooTopPriorities } from "../../agents/executive-coo-ranking";
import { buildExecutiveCooFactsFromSnapshot, buildValidExecutiveCooDraft } from "./helpers";

describe("Executive COO validator edge cases", () => {
  it("rejects operations health mismatch", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const output = buildValidExecutiveCooDraft(facts);
    output.operationsHealthScore = facts.operationsHealthScore + 1;

    expect(() => validateExecutiveCooBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate priority titles in same focus area", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const output = buildValidExecutiveCooDraft(facts);
    output.topPriorities[1] = {
      ...output.topPriorities[0]!,
      id: "executive-coo:duplicate-title",
    };

    expect(() => validateExecutiveCooBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("ranks inventory priorities ahead when inventory is preferred", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    facts.merchantOperationalPreferences.prefersInventoryFirst = true;
    const draft = buildValidExecutiveCooDraft(facts);
    const impacts = new Map(
      draft.topPriorities.map((priority) => [
        priority.id,
        estimateExecutiveCooPriorityImpact(facts, priority),
      ]),
    );

    const ranked = rankExecutiveCooTopPriorities({ facts, priorities: draft.topPriorities, impacts });
    expect(ranked[0]?.focusArea).toBe("Inventory");
  });
});
