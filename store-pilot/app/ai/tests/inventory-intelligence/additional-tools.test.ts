import { describe, expect, it } from "vitest";

import { calculateInventoryHealthScore, classifyInventoryHealthBand } from "../../tools/inventory-health-tool";
import { calculateOverstockRisk, calculateUnderstockRisk, predictStockoutDate } from "../../tools/stockout-risk-tool";
import { calculateInventoryAgingDays, classifyDeadStock, classifyInventoryAgeBand } from "../../tools/inventory-aging-tool";
import {
  calculateDaysOfInventoryRemaining,
  calculateInventoryTurnover,
  calculateInventoryVelocity,
} from "../../tools/inventory-velocity-tool";
import {
  buildReorderSuggestion,
  calculateEstimatedRunOutDate,
  calculateReorderUrgency,
  calculateSafetyStock,
} from "../../tools/reorder-tool";
import { classifyDeadInventory } from "../../tools/dead-stock-tool";
import { estimateInventoryRecommendationImpact } from "../../tools/inventory-impact-tool";

describe("Inventory Intelligence deterministic tool edge cases", () => {
  it("scores empty catalogs conservatively", () => {
    expect(calculateInventoryHealthScore({
      stockoutAlertCount: 0,
      deadStockCount: 0,
      overstockCount: 0,
      understockCount: 0,
      totalProducts: 0,
      averageDaysRemaining: null,
      averageTurnover: 0,
    })).toBe(50);
  });

  it("classifies health bands", () => {
    expect(classifyInventoryHealthBand(85)).toBe("healthy");
    expect(classifyInventoryHealthBand(50)).toBe("at_risk");
  });

  it("handles zero velocity stockout prediction", () => {
    expect(
      predictStockoutDate({
        availableInventory: 10,
        velocity: 0,
        computedAt: "2026-06-20T10:00:00.000Z",
      }).stockoutRisk,
    ).toBe("LOW");
  });

  it("detects overstock and understock risk", () => {
    expect(calculateOverstockRisk({ daysRemaining: 150, velocity: 0.1, availableInventory: 100 })).toBe(true);
    expect(calculateUnderstockRisk({ daysRemaining: 10, stockRisk: "HIGH" })).toBe(true);
  });

  it("classifies aging bands and dead stock", () => {
    expect(classifyInventoryAgeBand(15)).toBe("fresh");
    expect(classifyInventoryAgeBand(120)).toBe("dead");
    expect(
      classifyDeadStock({
        agingDays: 100,
        velocity: 0.05,
        availableInventory: 20,
        sales90Days: 1,
      }),
    ).toBe(true);
  });

  it("calculates velocity, turnover, and days remaining", () => {
    expect(calculateInventoryVelocity(60)).toBe(2);
    expect(calculateInventoryTurnover({ sales30Days: 30, averageInventory: 15 })).toBe(2);
    expect(calculateDaysOfInventoryRemaining(30, 2)).toBe(15);
    expect(calculateDaysOfInventoryRemaining(30, 0)).toBeNull();
  });

  it("calculates safety stock and reorder urgency", () => {
    expect(calculateSafetyStock(2, 14)).toBeGreaterThan(0);
    expect(calculateReorderUrgency({ daysRemaining: 0, stockRisk: "CRITICAL", velocity: 1 })).toBe(1);
    expect(
      buildReorderSuggestion({
        productId: "product-1",
        title: "Blue Hoodie",
        velocity: 2,
        availableInventory: 4,
        safetyStock: 20,
        reorderUrgency: 2,
      })?.suggestedQuantity,
    ).toBeGreaterThan(0);
  });

  it("predicts run-out dates", () => {
    expect(
      calculateEstimatedRunOutDate({
        availableInventory: 10,
        velocity: 2,
        computedAt: "2026-06-20T10:00:00.000Z",
      }),
    ).toContain("2026-06-");
  });

  it("classifies dead inventory with reasons", () => {
    const dead = classifyDeadInventory({
      agingDays: 95,
      velocity: 0.05,
      availableInventory: 12,
      sales90Days: 0,
    });

    expect(dead.isDeadStock).toBe(true);
    expect(dead.reason).toContain("No sales");
  });

  it("estimates inventory-only impact categories", () => {
    const stockoutImpact = estimateInventoryRecommendationImpact({
      category: "Stockout",
      velocity: 2,
      availableInventory: 4,
      daysRemaining: 2,
      safetyStock: 20,
      tiedUpUnits: 4,
      unitCost: 10,
    });
    const clearanceImpact = estimateInventoryRecommendationImpact({
      category: "Clearance",
      velocity: 0,
      availableInventory: 40,
      daysRemaining: 120,
      safetyStock: 0,
      tiedUpUnits: 40,
      unitCost: 10,
    });

    expect(stockoutImpact.ordersProtected).toBeGreaterThan(0);
    expect(clearanceImpact.inventoryCostSaved).toBeGreaterThan(0);
    expect(stockoutImpact).not.toHaveProperty("revenueRecovered");
  });

  it("computes aging days from updatedAt fallback", () => {
    expect(
      calculateInventoryAgingDays({
        lastSaleAt: null,
        updatedAt: "2026-06-01T00:00:00.000Z",
        computedAt: "2026-06-20T00:00:00.000Z",
      }),
    ).toBe(19);
  });
});
