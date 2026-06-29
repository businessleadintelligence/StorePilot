import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import type { InventoryIntelligenceOutput } from "../../schemas/inventory-intelligence";
import { validateInventoryIntelligenceBusinessRules } from "../../agents/inventory-intelligence.validator";
import {
  buildInventoryFactsFromSnapshot,
  buildValidInventoryIntelligenceDraft,
} from "./helpers";

describe("Inventory Intelligence validator", () => {
  it("rejects health score mismatches", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const output = buildValidInventoryIntelligenceDraft(facts);
    output.inventoryHealthScore = facts.inventoryHealthScore + 5;

    expect(() => validateInventoryIntelligenceBusinessRules(facts, output)).toThrow(
      AIPlatformError,
    );
  });

  it("rejects duplicate recommendation ids", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const output = buildValidInventoryIntelligenceDraft(facts);
    output.recommendations[1] = {
      ...output.recommendations[0],
      title: "Duplicate reorder recommendation for Blue Hoodie",
    };

    expect(() => validateInventoryIntelligenceBusinessRules(facts, output)).toThrow(
      AIPlatformError,
    );
  });

  it("rejects recommendations without evidence keys", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const output = buildValidInventoryIntelligenceDraft(facts);
    output.recommendations[0].evidenceKeys = [];

    expect(() => validateInventoryIntelligenceBusinessRules(facts, output)).toThrow(
      AIPlatformError,
    );
  });

  it("enriches valid inventory output in place", () => {
    const facts = buildInventoryFactsFromSnapshot();
    const output = buildValidInventoryIntelligenceDraft(facts);

    validateInventoryIntelligenceBusinessRules(facts, output);

    const enrichedRecommendation = output.recommendations[0] as InventoryIntelligenceOutput["recommendations"][number] & {
      evidence?: string[];
      group?: string;
    };

    expect(enrichedRecommendation.evidence?.length).toBeGreaterThan(0);
    expect(enrichedRecommendation.group).toBeTruthy();
    expect(output.healthExplanation?.score).toBe(facts.inventoryHealthScore);
  });
});
