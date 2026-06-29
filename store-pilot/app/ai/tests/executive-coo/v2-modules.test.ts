import { describe, expect, it } from "vitest";

import {
  shouldExpireExecutiveCooPriority,
  getExecutiveCooPriorityExpirationReason,
} from "../../agents/executive-coo-expiration";
import { buildExecutiveCooHealthExplanation } from "../../agents/executive-coo-health";
import { buildExecutiveCooFactsFromSnapshot } from "./helpers";

describe("Executive COO v2 modules", () => {
  it("expires resolved revenue priorities", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    facts.revenueOpportunity = 0;

    expect(
      shouldExpireExecutiveCooPriority({
        facts,
        payload: { focusArea: "Revenue" },
        status: "open",
      }),
    ).toBe(true);
    expect(
      getExecutiveCooPriorityExpirationReason({
        facts,
        payload: { focusArea: "Revenue" },
      }),
    ).toBe("revenue_opportunity_closed");
  });

  it("builds health explanation for operations module", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const explanation = buildExecutiveCooHealthExplanation(facts);
    expect(explanation.drivers.some((driver) => driver.factor.includes("Operations"))).toBe(true);
  });
});
