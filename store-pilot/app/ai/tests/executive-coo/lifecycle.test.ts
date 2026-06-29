import { describe, expect, it } from "vitest";

import {
  getExecutiveCooPriorityExpirationReason,
  shouldExpireExecutiveCooPriority,
  getExecutiveCooPriorityVerificationReason,
} from "../../agents/executive-coo-expiration";
import { buildExecutiveCooFactsFromSnapshot } from "./helpers";
import { recordExecutiveCooMerchantPriorityFeedback } from "../../../services/executive-coo-lifecycle.server";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";

describe("Executive COO lifecycle and memory", () => {
  it("expires inventory priorities when inventory risk improves", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    facts.inventoryRisk = 10;

    expect(
      shouldExpireExecutiveCooPriority({
        facts,
        payload: { focusArea: "Inventory" },
        status: "open",
      }),
    ).toBe(true);
    expect(
      getExecutiveCooPriorityExpirationReason({
        facts,
        payload: { focusArea: "Inventory" },
      }),
    ).toBe("inventory_risk_resolved");
  });

  it("verifies operations improvements", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    facts.operationsHealthScore = 80;

    expect(
      getExecutiveCooPriorityVerificationReason({
        facts,
        payload: { focusArea: "Operations" },
      }),
    ).toBe("operations_health_improved");
  });

  it("records merchant priority feedback", async () => {
    const persistence = createInMemoryAIPersistence();
    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "executive_coo",
        subjectKey: "executive-coo:store-1",
        stableId: "stable-executive-1",
        title: "Replenish inventory",
        summary: "Protect hero SKU revenue",
        category: "Inventory",
        priority: 1,
        confidence: 0.9,
        status: "open",
        runId: "run-1",
        payloadJson: { id: "executive-coo:inventory" },
      },
    ]);

    await recordExecutiveCooMerchantPriorityFeedback({
      storeId: "store-1",
      subjectKey: "executive-coo:store-1",
      stableId: "stable-executive-1",
      feedback: "view",
      persistence,
    });

    const records = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "executive-coo:store-1",
    });

    expect(records[0]?.status).toBe("viewed");
  });
});
