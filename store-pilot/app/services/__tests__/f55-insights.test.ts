import { beforeEach, describe, expect, it } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import { calculateStoreHealthScore } from "../health-score.server";
import type { OnboardingStatusResponse } from "../onboarding-ui.server";
import {
  buildStoreInsights,
  getStoreInsights,
  sortStoreInsights,
} from "../insights.server";
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
  return buildStoreInsights({
    metrics,
    onboarding,
    healthScore: calculateStoreHealthScore(metrics),
  });
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
});

describe("F.5.5 Operational Insights Engine", () => {
  it("1. creates inventory insights for out of stock and low stock", () => {
    const result = buildInput({
      ...HEALTHY_METRICS,
      outOfStockProducts: 2,
      lowStockProducts: 3,
    });

    expect(result.insights).toContainEqual(
      expect.objectContaining({
        id: "inventory-out-of-stock",
        category: "inventory",
        severity: "critical",
      }),
    );
    expect(result.insights).toContainEqual(
      expect.objectContaining({
        id: "inventory-low-stock",
        category: "inventory",
        severity: "warning",
      }),
    );
  });

  it("2. creates product and order insights", () => {
    const result = buildInput({
      ...HEALTHY_METRICS,
      products: 0,
      activeProducts: 0,
      orders: 0,
      grossRevenue: 0,
      averageOrderValue: 0,
    });

    expect(result.insights).toContainEqual(
      expect.objectContaining({
        id: "products-not-synced",
        category: "products",
        severity: "critical",
      }),
    );
    expect(result.insights).toContainEqual(
      expect.objectContaining({
        id: "orders-not-imported",
        category: "orders",
        severity: "warning",
      }),
    );
  });

  it("3. creates health and onboarding insights", () => {
    const result = buildInput(
      {
        ...HEALTHY_METRICS,
        lowStockProducts: 11,
      },
      {
        ...COMPLETED_ONBOARDING,
        status: "running",
        ordersSyncStatus: "blocked",
        completedAt: null,
      },
    );

    expect(result.insights).toContainEqual(
      expect.objectContaining({
        id: "health-below-target",
        category: "health",
        severity: "warning",
      }),
    );
    expect(result.insights).toContainEqual(
      expect.objectContaining({
        id: "onboarding-in-progress",
        category: "onboarding",
        severity: "info",
      }),
    );
    expect(result.insights).toContainEqual(
      expect.objectContaining({
        id: "orders-sync-blocked",
        category: "onboarding",
        severity: "info",
      }),
    );
  });

  it("4. sorts insights by severity then rule order", () => {
    const result = buildInput(
      {
        ...HEALTHY_METRICS,
        products: 0,
        activeProducts: 0,
        orders: 0,
        grossRevenue: 0,
        averageOrderValue: 0,
        outOfStockProducts: 1,
      },
      {
        ...COMPLETED_ONBOARDING,
        status: "running",
        ordersSyncStatus: "blocked",
        completedAt: null,
      },
    );

    expect(result.insights.map((item) => item.id)).toEqual([
      "inventory-out-of-stock",
      "products-not-synced",
      "orders-not-imported",
      "health-below-target",
      "onboarding-in-progress",
      "orders-sync-blocked",
    ]);
  });

  it("5. returns empty insights for healthy operations", () => {
    const result = buildInput(HEALTHY_METRICS);

    expect(result.insights).toEqual([]);
  });

  it("6. avoids duplicate insight ids", () => {
    const result = buildInput(
      {
        ...HEALTHY_METRICS,
        products: 0,
        activeProducts: 0,
        orders: 0,
        outOfStockProducts: 1,
      },
      {
        ...COMPLETED_ONBOARDING,
        status: "running",
        ordersSyncStatus: "blocked",
        completedAt: null,
      },
    );

    const ids = result.insights.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("7. exposes merchant-safe insight text only", () => {
    const result = buildInput(
      {
        ...HEALTHY_METRICS,
        products: 0,
        activeProducts: 0,
        orders: 0,
        outOfStockProducts: 1,
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

  it("8. loads insights from store data", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/insight-1",
      inventoryQuantity: 0,
    });

    const result = await getStoreInsights(STORE_ID);

    expect(result.insights.some((item) => item.id === "inventory-out-of-stock")).toBe(
      true,
    );
  });
});

describe("F.5.5 Insight sorting helper", () => {
  it("orders critical before warning before info", () => {
    const sorted = sortStoreInsights([
      {
        id: "onboarding-in-progress",
        category: "onboarding",
        severity: "info",
        title: "Info",
        description: "Info",
      },
      {
        id: "inventory-low-stock",
        category: "inventory",
        severity: "warning",
        title: "Warning",
        description: "Warning",
      },
      {
        id: "inventory-out-of-stock",
        category: "inventory",
        severity: "critical",
        title: "Critical",
        description: "Critical",
      },
    ]);

    expect(sorted.map((item) => item.severity)).toEqual([
      "critical",
      "warning",
      "info",
    ]);
  });
});
