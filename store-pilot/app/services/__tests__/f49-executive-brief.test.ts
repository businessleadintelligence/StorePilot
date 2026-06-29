import { beforeEach, describe, expect, it } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import { calculateStoreHealthScore } from "../health-score.server";
import {
  buildExecutiveConcerns,
  buildExecutiveHeadline,
  buildExecutiveHighlights,
  buildExecutiveSummary,
  calculateExecutiveBrief,
  getExecutiveBrief,
} from "../executive-brief.server";
import type { StoreSyncStatus } from "../sync-status.server";

const EMPTY_SYNC_STATUS: StoreSyncStatus = {
  onboardingStatus: null,
  products: { synced: false, count: 0, lastSyncAt: null },
  inventory: { synced: false, count: 0, lastSyncAt: null },
  orders: {
    synced: false,
    count: 0,
    lastSyncAt: null,
    blocked: false,
    blockedReason: null,
  },
};

function buildBriefInput(
  metrics: Parameters<typeof calculateExecutiveBrief>[0]["metrics"],
  syncStatus: StoreSyncStatus | null = EMPTY_SYNC_STATUS,
) {
  return calculateExecutiveBrief({
    metrics,
    healthScore: calculateStoreHealthScore(metrics),
    syncStatus,
    currency: "USD",
  });
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
});

describe("F.4.9 Executive Brief Engine", () => {
  it("1. builds empty store brief", async () => {
    const brief = await getExecutiveBrief(STORE_ID);

    expect(brief.headline).toBe("Store setup is not complete");
    expect(brief.summary).toBe("No products have been synced yet.");
    expect(brief.highlights).toEqual([]);
    expect(brief.concerns).toEqual([
      "No products synced",
      "No orders have been synced",
    ]);
  });

  it("2. builds products-only brief", () => {
    const brief = buildBriefInput({
      products: 27,
      activeProducts: 27,
      orders: 0,
      grossRevenue: 0,
      averageOrderValue: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      inventoryUnits: 100,
    });

    expect(brief.headline).toBe(
      "Products are synced but no orders have been imported",
    );
    expect(brief.summary).toContain("27 products are synced");
    expect(brief.highlights).toEqual(["27 products synced"]);
    expect(brief.concerns).toEqual(["No orders have been synced"]);
  });

  it("3. builds products and orders brief with factual summary", () => {
    const brief = buildBriefInput({
      products: 27,
      activeProducts: 27,
      orders: 173,
      grossRevenue: 12450,
      averageOrderValue: 71.96,
      lowStockProducts: 3,
      outOfStockProducts: 1,
      inventoryUnits: 540,
    });

    expect(brief.summary).toBe(
      "27 products are synced. 173 orders have been imported. Store health score is 79. $12,450 revenue has been recorded.",
    );
    expect(brief.highlights).toEqual([
      "27 products synced",
      "173 orders imported",
      "$12,450 revenue recorded",
    ]);
  });

  it("4. uses healthy headline when score is 90 or above", () => {
    const brief = buildBriefInput({
      products: 60,
      activeProducts: 60,
      orders: 120,
      grossRevenue: 10000,
      averageOrderValue: 83.33,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      inventoryUnits: 500,
    });

    expect(brief.metrics.healthScore).toBeGreaterThanOrEqual(90);
    expect(brief.headline).toBe("Store operations are healthy");
    expect(brief.concerns).toEqual([]);
  });

  it("5. uses attention headline for mid-range scores", () => {
    const metrics = {
      products: 27,
      activeProducts: 27,
      orders: 173,
      grossRevenue: 12450,
      averageOrderValue: 71.96,
      lowStockProducts: 3,
      outOfStockProducts: 0,
      inventoryUnits: 540,
    };

    expect(buildExecutiveHeadline(metrics, calculateStoreHealthScore(metrics))).toBe(
      "Store operations require attention",
    );
  });

  it("6. uses improvement headline for low scores", () => {
    const metrics = {
      products: 5,
      activeProducts: 5,
      orders: 2,
      grossRevenue: 100,
      averageOrderValue: 50,
      lowStockProducts: 2,
      outOfStockProducts: 2,
      inventoryUnits: 10,
    };

    expect(buildExecutiveHeadline(metrics, calculateStoreHealthScore(metrics))).toBe(
      "Store health needs improvement",
    );
  });

  it("7. adds blocked orders concern from sync status", () => {
    const metrics = {
      products: 27,
      activeProducts: 27,
      orders: 0,
      grossRevenue: 0,
      averageOrderValue: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      inventoryUnits: 100,
    };
    const healthScore = calculateStoreHealthScore(metrics);
    const syncStatus: StoreSyncStatus = {
      ...EMPTY_SYNC_STATUS,
      orders: {
        synced: false,
        count: 0,
        lastSyncAt: null,
        blocked: true,
        blockedReason: "order_access_pending",
      },
    };

    expect(buildExecutiveConcerns(healthScore, syncStatus)).toEqual([
      "No orders have been synced",
      "Orders sync is waiting for Shopify approval",
    ]);
  });

  it("8. keeps merchant-safe language with no internal messages", () => {
    const brief = buildBriefInput({
      products: 10,
      activeProducts: 10,
      orders: 5,
      grossRevenue: 500,
      averageOrderValue: 100,
      lowStockProducts: 1,
      outOfStockProducts: 1,
      inventoryUnits: 20,
    });

    const serialized = JSON.stringify(brief);

    expect(serialized).not.toContain("GraphQL");
    expect(serialized).not.toContain("worker");
    expect(serialized).not.toContain("recommend");
    expect(serialized).not.toContain("blockedMessage");
    expect(brief.highlights.length).toBeGreaterThan(0);
  });
});
