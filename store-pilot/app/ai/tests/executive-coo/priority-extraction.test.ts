import { describe, expect, it } from "vitest";

import { extractExecutiveCooPriorities } from "../../agents/executive-coo.validator";
import { mutateAndEnrichExecutiveCooOutput } from "../../agents/executive-coo-enrichment";
import { runWithExecutiveCooContext } from "../../agents/agent-execution-context";
import { buildExecutiveCooFactsFromSnapshot, buildValidExecutiveCooDraft } from "./helpers";

describe("Executive COO priority extraction", () => {
  it("extracts open priorities for persistence", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const output = buildValidExecutiveCooDraft(facts);

    const extracted = extractExecutiveCooPriorities(output);
    expect(extracted.length).toBe(output.topPriorities.length);
    expect(extracted[0]?.title).toBeTruthy();
  });

  it("skips implemented priorities from memory", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const output = buildValidExecutiveCooDraft(facts);

    const extracted = await runWithExecutiveCooContext(
      {
        storeId: "store-1",
        subjectKey: "executive-coo:store-1",
        recommendationMemory: {
          implementedIds: new Set([output.topPriorities[0]!.id]),
          dismissedIds: new Set(),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
        recommendationRecords: [],
      },
      () => extractExecutiveCooPriorities(output),
    );

    expect(extracted.some((item) => item.title === output.topPriorities[0]?.title)).toBe(false);
  });

  it("enriches priorities with evidence and groups", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const enriched = mutateAndEnrichExecutiveCooOutput({ facts, output: draft });

    expect(enriched.operationsHealthScore).toBe(facts.operationsHealthScore);
    expect(enriched.topPriorities[0]?.group).toBeTruthy();
  });
});
