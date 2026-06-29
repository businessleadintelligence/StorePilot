import { describe, expect, it } from "vitest";

import {
  EXECUTIVE_COO_FOCUS_AREAS,
  executiveCooEnrichedSchema,
  executiveCooSchema,
} from "../../schemas/executive-coo";
import {
  buildExecutiveCooFactsFromSnapshot,
  buildValidExecutiveCooDraft,
} from "./helpers";
import { mutateAndEnrichExecutiveCooOutput } from "../../agents/executive-coo-enrichment";

describe("Executive COO schema", () => {
  it("accepts a valid draft output", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);

    expect(executiveCooSchema.safeParse(draft).success).toBe(true);
  });

  it("accepts enriched output after deterministic enrichment", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const enriched = mutateAndEnrichExecutiveCooOutput({ facts, output: draft });

    expect(executiveCooEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.topPriorities[0]?.evidence.length).toBeGreaterThan(0);
    expect(
      Object.values(enriched.focusAreaGroups).some((group) => group.length > 0),
    ).toBe(true);
  });

  it("defines all required executive focus areas", () => {
    expect(EXECUTIVE_COO_FOCUS_AREAS).toContain("Revenue");
    expect(EXECUTIVE_COO_FOCUS_AREAS).toContain("Inventory");
    expect(EXECUTIVE_COO_FOCUS_AREAS).toContain("Operations");
    expect(EXECUTIVE_COO_FOCUS_AREAS.length).toBe(10);
  });
});
