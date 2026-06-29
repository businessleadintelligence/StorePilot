import { beforeEach, describe, expect, it } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  formatCurrency,
  formatMetricNumber,
  getStoreMetrics,
  serializeMetricsForLoader,
} from "../metrics.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
});

describe("F.4.7 Metrics Service", () => {
  it("1. returns zero metrics for empty database without nulls", async () => {
    const metrics = await getStoreMetrics(STORE_ID);

    expect(metrics).toEqual({
      products: 0,
      activeProducts: 0,
      orders: 0,
      grossRevenue: 0,
      averageOrderValue: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      inventoryUnits: 0,
    });
    expect(metrics).not.toBeNull();
  });

  it("2. counts total and active products", async () => {
    const harness = testHarness();

    for (let index = 0; index < 3; index += 1) {
      harness.seedProduct({
        shopifyVariantId: `gid://shopify/ProductVariant/active-${index}`,
        shopifyProductId: `gid://shopify/Product/active-${index}`,
      });
    }

    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/archived-1",
      shopifyProductId: "gid://shopify/Product/archived-1",
      status: "archived",
    });

    const metrics = await getStoreMetrics(STORE_ID);

    expect(metrics.products).toBe(4);
    expect(metrics.activeProducts).toBe(3);
  });

  it("3. counts orders separately from paid revenue", async () => {
    const harness = testHarness();

    harness.seedOrder({
      shopifyOrderId: "gid://shopify/Order/paid-1",
      totalPriceAmount: "100.00",
      isPaid: true,
    });
    harness.seedOrder({
      shopifyOrderId: "gid://shopify/Order/unpaid-1",
      totalPriceAmount: "50.00",
      isPaid: false,
    });

    const metrics = await getStoreMetrics(STORE_ID);

    expect(metrics.orders).toBe(2);
    expect(metrics.grossRevenue).toBe(100);
  });

  it("4. aggregates gross revenue from paid orders only", async () => {
    const harness = testHarness();

    harness.seedOrder({
      shopifyOrderId: "gid://shopify/Order/paid-1",
      totalPriceAmount: "100.00",
      isPaid: true,
    });
    harness.seedOrder({
      shopifyOrderId: "gid://shopify/Order/paid-2",
      totalPriceAmount: "50.00",
      isPaid: true,
    });
    harness.seedOrder({
      shopifyOrderId: "gid://shopify/Order/unpaid-2",
      totalPriceAmount: "999.00",
      isPaid: false,
    });

    const metrics = await getStoreMetrics(STORE_ID);

    expect(metrics.grossRevenue).toBe(150);
    expect(metrics.grossRevenue).toBeGreaterThanOrEqual(0);
  });

  it("5. calculates average order value without divide-by-zero", async () => {
    const emptyMetrics = await getStoreMetrics(STORE_ID);
    expect(emptyMetrics.averageOrderValue).toBe(0);

    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: "gid://shopify/Order/paid-aov-1",
      totalPriceAmount: "100.00",
      isPaid: true,
    });
    harness.seedOrder({
      shopifyOrderId: "gid://shopify/Order/paid-aov-2",
      totalPriceAmount: "50.00",
      isPaid: true,
    });

    const metrics = await getStoreMetrics(STORE_ID);

    expect(metrics.averageOrderValue).toBe(75);
    expect(metrics.averageOrderValue).toBeGreaterThanOrEqual(0);
  });

  it("6. counts low stock, out of stock, and inventory units", async () => {
    const harness = testHarness();

    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/low-1",
      inventoryQuantity: 3,
      inventoryTracked: true,
    });
    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/low-2",
      inventoryQuantity: 5,
      inventoryTracked: true,
    });
    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/out-1",
      inventoryQuantity: 0,
      inventoryTracked: true,
    });
    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/healthy-1",
      inventoryQuantity: 20,
      inventoryTracked: true,
    });
    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/untracked-1",
      inventoryQuantity: 2,
      inventoryTracked: false,
    });

    const metrics = await getStoreMetrics(STORE_ID);

    expect(metrics.lowStockProducts).toBe(3);
    expect(metrics.outOfStockProducts).toBe(1);
    expect(metrics.inventoryUnits).toBe(28);
  });

  it("7. serializes metrics with non-negative values", async () => {
    const serialized = serializeMetricsForLoader({
      products: 27,
      activeProducts: 25,
      orders: 173,
      grossRevenue: 12450,
      averageOrderValue: 71.965,
      lowStockProducts: 3,
      outOfStockProducts: 1,
      inventoryUnits: 540,
    });

    expect(serialized).toEqual({
      products: 27,
      activeProducts: 25,
      orders: 173,
      grossRevenue: 12450,
      averageOrderValue: 71.965,
      lowStockProducts: 3,
      outOfStockProducts: 1,
      inventoryUnits: 540,
    });
    expect(Object.values(serialized).every((value) => value !== null)).toBe(true);
  });

  it("8. formats merchant-facing currency and numbers", () => {
    expect(formatCurrency(12450)).toBe("$12,450");
    expect(formatCurrency(71.96)).toBe("$71.96");
    expect(formatMetricNumber(173)).toBe("173");
    expect(formatMetricNumber(0)).toBe("0");
  });
});
