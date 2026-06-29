import { describe, expect, it } from "vitest";

import { EXECUTIVE_COO_FOCUS_AREAS, EXECUTIVE_COO_GROUPS } from "../../schemas/executive-coo";
import { assignExecutiveCooGroupFromImpact } from "../../agents/executive-coo-groups";
import { buildExecutiveCooHealthExplanation } from "../../agents/executive-coo-health";
import { buildMockExecutiveCooFacts } from "./helpers";

describe("Executive COO tool exports", () => {
  it("exports focus areas and groups", () => {
    expect(EXECUTIVE_COO_FOCUS_AREAS).toContain("Operations");
    expect(EXECUTIVE_COO_GROUPS).toContain("Critical Operations");
  });

  it("assigns known executive groups", () => {
    expect(
      assignExecutiveCooGroupFromImpact({
        focusArea: "Revenue",
        priorityScore: 90,
        impact: { revenueOpportunity: 5000 },
      }),
    ).toBe("Revenue Recovery");
  });

  it("builds health explanation export", () => {
    const explanation = buildExecutiveCooHealthExplanation(buildMockExecutiveCooFacts());
    expect(explanation.drivers.length).toBeGreaterThan(0);
  });
});
