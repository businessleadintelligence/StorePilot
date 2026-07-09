import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  buildExecutiveCooFactsFromSnapshot,
  buildValidExecutiveCooDraft,
 createMockExecutiveCooSnapshot } from "./helpers";
import {
  isVagueExecutiveCooPriorityText,
  validateExecutiveCooBusinessRules,
} from "../../agents/executive-coo.validator";
import { mutateAndEnrichExecutiveCooOutput } from "../../agents/executive-coo-enrichment";
import { createExecutiveCooFactsBuilder } from "../../facts/executive-coo-facts";


describe("Executive COO validator", () => {
  it("rejects health score mismatch", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const output = buildValidExecutiveCooDraft(facts);
    output.operationsHealthScore = facts.operationsHealthScore + 5;

    expect(() => validateExecutiveCooBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate recommendation ids", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const output = buildValidExecutiveCooDraft(facts);
    output.topPriorities[1] = { ...output.topPriorities[0]! };

    expect(() => validateExecutiveCooBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown evidence keys", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const output = buildValidExecutiveCooDraft(facts);
    output.topPriorities[0]!.evidenceKeys = ["unknown_evidence_key"];

    expect(() => validateExecutiveCooBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects vague recommendations", () => {
    expect(isVagueExecutiveCooPriorityText("increase revenue")).toBe(true);
    expect(isVagueExecutiveCooPriorityText("Replenish Protein Powder before stockout")).toBe(false);
  });

  it("enriches valid output in-place", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const output = buildValidExecutiveCooDraft(facts);

    validateExecutiveCooBusinessRules(facts, output);

    const enrichedRecommendation = output.topPriorities[0] as typeof output.topPriorities[number] & {
      evidence?: string[];
    };
    expect(output.healthExplanation?.score).toBe(facts.operationsHealthScore);
    expect(enrichedRecommendation.evidence?.length).toBeGreaterThan(0);
  });

  it("mutates enriched recommendations with groups and verification", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const output = buildValidExecutiveCooDraft(facts);
    const enriched = mutateAndEnrichExecutiveCooOutput({ facts, output });

    expect(enriched.topPriorities[0]?.group).toBeTruthy();
    expect(enriched.topPriorities[0]?.verification.expectedMetric).toBeTruthy();
  });

  it("validates builder-backed draft output", async () => {
    const snapshot = createMockExecutiveCooSnapshot();
    const builder = createExecutiveCooFactsBuilder({
      async getExecutiveCooSnapshot() {
        return snapshot;
      },
    });
    const facts = await builder.build({ storeId: "store-1", agentId: "executive_coo" });
    const output = buildValidExecutiveCooDraft(facts);

    validateExecutiveCooBusinessRules(facts, output);
  });
});
