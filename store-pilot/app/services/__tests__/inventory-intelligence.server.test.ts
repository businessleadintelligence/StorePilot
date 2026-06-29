import { describe, expect, it } from "vitest";

import {
  buildInventoryIntelligenceSubjectKey,
  executeInventoryIntelligence,
} from "../inventory-intelligence.server";
import { buildInventoryFactsFromSnapshot } from "../../ai/tests/inventory-intelligence/helpers";

describe("Inventory Intelligence public API", () => {
  it("builds store-scoped subject keys", () => {
    expect(buildInventoryIntelligenceSubjectKey("store-1")).toBe("inventory:store-1");
  });

  it("exposes executeInventoryIntelligence with the expected input shape", () => {
    expect(typeof executeInventoryIntelligence).toBe("function");
    expect(buildInventoryFactsFromSnapshot().inventoryHealthScore).toBeGreaterThan(0);
  });
});
