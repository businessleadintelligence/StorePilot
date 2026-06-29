import { describe, expect, it } from "vitest";

import { createInventoryFactsBuilder } from "../../facts/inventory-facts";
import { calculateInventoryHealthScore } from "../../tools/inventory-health-tool";
import { predictStockoutDate } from "../../tools/stockout-risk-tool";
import { classifyDeadStock } from "../../tools/inventory-aging-tool";
import { calculateInventoryTurnover } from "../../tools/inventory-velocity-tool";
import { calculateReorderUrgency } from "../../tools/reorder-tool";
import { createMockInventoryProduct, createMockInventorySnapshot } from "./helpers";

describe("Inventory Intelligence tools", () => {
  it("calculates inventory health score from operational signals", () => {
    const score = calculateInventoryHealthScore({
      stockoutAlertCount: 2,
      deadStockCount: 1,
      overstockCount: 1,
      understockCount: 2,
      totalProducts: 10,
      averageDaysRemaining: 18,
      averageTurnover: 0.8,
    });

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("predicts stockout dates from velocity and available inventory", () => {
    const prediction = predictStockoutDate({
      availableInventory: 14,
      velocity: 2,
      computedAt: "2026-06-20T10:00:00.000Z",
    });

    expect(prediction.daysUntilStockout).toBe(7);
    expect(prediction.stockoutRisk).toBe("CRITICAL");
  });

  it("classifies dead stock from aging and velocity", () => {
    expect(
      classifyDeadStock({
        agingDays: 95,
        velocity: 0.05,
        availableInventory: 40,
        sales90Days: 2,
      }),
    ).toBe(true);
  });

  it("calculates turnover and reorder urgency", () => {
    expect(
      calculateInventoryTurnover({
        sales30Days: 30,
        averageInventory: 15,
      }),
    ).toBe(2);

    expect(
      calculateReorderUrgency({
        daysRemaining: 6,
        stockRisk: "HIGH",
        velocity: 1.2,
      }),
    ).toBe(2);
  });
});

describe("Inventory Intelligence fact builder", () => {
  it("builds typed store inventory facts from snapshots", async () => {
    const builder = createInventoryFactsBuilder({
      async getStoreInventorySnapshot() {
        return createMockInventorySnapshot([createMockInventoryProduct()]);
      },
    });

    const facts = await builder.build({ storeId: "store-1" });

    expect(facts.inventoryHealthScore).toBeGreaterThan(0);
    expect(facts.products).toHaveLength(1);
    expect(facts.stockAlerts.length).toBeGreaterThan(0);
    expect(facts.reorderSuggestions.length).toBeGreaterThan(0);
    expect(builder.fingerprint(facts)).toMatch(/^[a-f0-9]{64}$/);
  });
});
