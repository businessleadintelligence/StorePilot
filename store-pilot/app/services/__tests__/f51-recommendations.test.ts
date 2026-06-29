import { beforeEach, describe, expect, it } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import { calculateStoreHealthScore } from "../health-score.server";
import type { OnboardingStatusResponse } from "../onboarding-ui.server";
import {
  buildStoreRecommendations,
  getStoreRecommendations,
  sortStoreRecommendations,
} from "../recommendations.server";
import type { StoreMetrics } from "../metrics.server";

const HEALTHY_METRICS: StoreMetrics = {
  products: 27,
  activeProducts: 27,
  orders: 173,
  grossRevenue: 12450,
  averageOrderValue: 71.96,
  lowStockProducts: 0,
  outOfStockProducts: 0,
  inventoryUnits: 540,
};

const COMPLETED_ONBOARDING: OnboardingStatusResponse = {
  status: "completed",
  progressPercent: 100,
  progressLabel: "Complete",
  productSyncStatus: "completed",
  inventorySyncStatus: "completed",
  ordersSyncStatus: "completed",
  blockedReason: null,
  blockedMessage: null,
  currentJobId: null,
  startedAt: new Date("2026-01-01T00:00:00Z"),
  completedAt: new Date("2026-01-02T00:00:00Z"),
};

function buildInput(
  metrics: StoreMetrics,
  onboarding: OnboardingStatusResponse | null = COMPLETED_ONBOARDING,
) {
  return buildStoreRecommendations({
    metrics,
    onboarding,
    healthScore: calculateStoreHealthScore(metrics),
  });
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
});

describe("F.5.1 Recommendation Engine", () => {
  it("1. creates critical recommendation for out of stock products", () => {
    const result = buildInput({
      ...HEALTHY_METRICS,
      outOfStockProducts: 2,
    });

    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        id: "inventory-out-of-stock",
        severity: "critical",
        title: "Products are out of stock",
        description: "2 products currently have zero inventory.",
        category: "inventory",
      }),
    );
    expect(result.critical).toBeGreaterThan(0);
  });

  it("2. creates warning recommendation for low stock products", () => {
    const result = buildInput({
      ...HEALTHY_METRICS,
      lowStockProducts: 3,
    });

    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        id: "inventory-low-stock",
        severity: "warning",
        title: "Low inventory detected",
        description: "3 products are running low on inventory.",
        category: "inventory",
      }),
    );
  });

  it("3. creates critical recommendation when no products are synced", () => {
    const result = buildInput({
      ...HEALTHY_METRICS,
      products: 0,
      activeProducts: 0,
      orders: 0,
    });

    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        id: "products-not-synced",
        severity: "critical",
        title: "No products synced",
        description: "StorePilot has not imported any products yet.",
        category: "products",
      }),
    );
  });

  it("4. creates warning recommendation when no orders are imported", () => {
    const result = buildInput({
      ...HEALTHY_METRICS,
      orders: 0,
      grossRevenue: 0,
      averageOrderValue: 0,
    });

    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        id: "orders-not-imported",
        severity: "warning",
        title: "No orders imported",
        description: "No orders have been imported into StorePilot.",
        category: "orders",
      }),
    );
  });

  it("5. creates info recommendation when onboarding is not completed", () => {
    const result = buildInput(HEALTHY_METRICS, {
      ...COMPLETED_ONBOARDING,
      status: "running",
      progressPercent: 40,
      completedAt: null,
    });

    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        id: "setup-in-progress",
        severity: "info",
        title: "Store setup in progress",
        description: "StorePilot is still syncing your store data.",
        category: "setup",
      }),
    );
  });

  it("6. creates info recommendation when orders sync is blocked", () => {
    const result = buildInput(HEALTHY_METRICS, {
      ...COMPLETED_ONBOARDING,
      status: "running",
      ordersSyncStatus: "blocked",
      blockedReason: "protected_customer_data",
    });

    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        id: "orders-sync-blocked",
        severity: "info",
        title: "Orders sync waiting for Shopify approval",
        description:
          "Products and inventory are already available while order access is pending.",
        category: "orders",
      }),
    );
  });

  it("7. creates warning recommendation when health score is below 70", () => {
    const result = buildInput({
      ...HEALTHY_METRICS,
      lowStockProducts: 11,
    });

    expect(calculateStoreHealthScore({
      ...HEALTHY_METRICS,
      lowStockProducts: 11,
    }).score).toBeLessThan(70);

    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        id: "health-below-target",
        severity: "warning",
        title: "Store health requires attention",
        description: "Store health score is currently below target.",
        category: "health",
      }),
    );
  });

  it("8. sorts recommendations by severity then rule order", () => {
    const result = buildInput(
      {
        ...HEALTHY_METRICS,
        products: 0,
        activeProducts: 0,
        orders: 0,
        grossRevenue: 0,
        averageOrderValue: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0,
      },
      {
        ...COMPLETED_ONBOARDING,
        status: "running",
        ordersSyncStatus: "blocked",
        completedAt: null,
      },
    );

    const ids = result.recommendations.map((item) => item.id);

    expect(ids).toEqual([
      "products-not-synced",
      "orders-not-imported",
      "health-below-target",
      "setup-in-progress",
      "orders-sync-blocked",
    ]);
    expect(result.critical).toBe(1);
    expect(result.warning).toBe(2);
    expect(result.info).toBe(2);
  });

  it("9. returns empty recommendations for healthy store operations", () => {
    const result = buildInput(HEALTHY_METRICS);

    expect(result.recommendations).toEqual([]);
    expect(result.critical).toBe(0);
    expect(result.warning).toBe(0);
    expect(result.info).toBe(0);
  });

  it("10. avoids duplicate recommendation ids", () => {
    const result = buildInput(
      {
        ...HEALTHY_METRICS,
        products: 0,
        activeProducts: 0,
        orders: 0,
        outOfStockProducts: 2,
        lowStockProducts: 3,
      },
      {
        ...COMPLETED_ONBOARDING,
        status: "running",
        ordersSyncStatus: "blocked",
        completedAt: null,
      },
    );

    const ids = result.recommendations.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("11. exposes merchant-safe text only", () => {
    const result = buildInput(
      {
        ...HEALTHY_METRICS,
        products: 0,
        activeProducts: 0,
        orders: 0,
        outOfStockProducts: 1,
        lowStockProducts: 2,
      },
      {
        ...COMPLETED_ONBOARDING,
        status: "running",
        ordersSyncStatus: "blocked",
        blockedReason: "graphql_access_denied_internal",
        blockedMessage: "Worker payload prisma exception at stack",
        completedAt: null,
      },
    );

    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/graphql/i);
    expect(serialized).not.toMatch(/worker/i);
    expect(serialized).not.toMatch(/payload/i);
    expect(serialized).not.toMatch(/prisma/i);
    expect(serialized).not.toMatch(/exception/i);
    expect(serialized).not.toMatch(/stack/i);
  });

  it("12. loads recommendations from store data", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/9001",
      inventoryQuantity: 0,
    });
    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/9002",
      inventoryQuantity: 5,
    });

    const result = await getStoreRecommendations(STORE_ID);

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((item) => item.id === "inventory-out-of-stock")).toBe(
      true,
    );
  });
});

describe("F.5.1 Recommendation sorting helper", () => {
  it("orders critical before warning before info", () => {
    const sorted = sortStoreRecommendations([
      {
        id: "setup-in-progress",
        severity: "info",
        title: "Info",
        description: "Info",
        category: "setup",
      },
      {
        id: "inventory-low-stock",
        severity: "warning",
        title: "Warning",
        description: "Warning",
        category: "inventory",
      },
      {
        id: "inventory-out-of-stock",
        severity: "critical",
        title: "Critical",
        description: "Critical",
        category: "inventory",
      },
    ]);

    expect(sorted.map((item) => item.severity)).toEqual([
      "critical",
      "warning",
      "info",
    ]);
  });
});
