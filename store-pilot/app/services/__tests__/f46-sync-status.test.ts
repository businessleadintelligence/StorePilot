import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  formatLastSyncAt,
  getOrdersBlockedCopy,
  getStoreSyncStatus,
  getSyncCountLabel,
  getSyncStatusBadge,
  serializeStoreSyncStatusForLoader,
  toMerchantBlockedReason,
} from "../sync-status.server";

function seedStoreSyncTimestamps(input: {
  productsAt?: Date;
  inventoryAt?: Date;
  ordersAt?: Date;
}) {
  const harness = testHarness();
  const store = harness.dbState.stores[0];
  if (!store) {
    throw new Error("expected store fixture");
  }

  store.lastProductsSyncAt = input.productsAt ?? null;
  store.lastInventorySyncAt = input.inventoryAt ?? null;
  store.lastOrdersSyncAt = input.ordersAt ?? null;
}

function seedOnboarding(overrides: {
  status?: "not_started" | "queued" | "running" | "completed" | "failed";
  productSyncStatus?:
    | "not_started"
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "blocked"
    | "skipped";
  inventorySyncStatus?:
    | "not_started"
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "blocked"
    | "skipped";
  ordersSyncStatus?:
    | "not_started"
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "blocked"
    | "skipped";
  blockedReason?: string | null;
  blockedMessage?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  progressPercent?: number;
  progressLabel?: string | null;
  completedAt?: Date | null;
}) {
  const harness = testHarness();
  harness.dbState.storeOnboarding.set(STORE_ID, {
    id: "onboarding-sync-status",
    storeId: STORE_ID,
    status: overrides.status ?? "running",
    onboardingRunId: "run-sync-status",
    currentJobId: null,
    productSyncStatus: overrides.productSyncStatus ?? "not_started",
    productSyncJobId: null,
    productSyncCompletedAt: null,
    inventorySyncStatus: overrides.inventorySyncStatus ?? "not_started",
    inventorySyncJobId: null,
    inventorySyncCompletedAt: null,
    ordersSyncStatus: overrides.ordersSyncStatus ?? "not_started",
    ordersSyncJobId: null,
    ordersSyncCompletedAt: null,
    blockedReason: overrides.blockedReason ?? null,
    blockedMessage:
      overrides.blockedMessage ??
      "GraphQL error: Access denied for orders field",
    degradedReason: null,
    progressPercent: overrides.progressPercent ?? 0,
    progressLabel: overrides.progressLabel ?? null,
    lastErrorCode: overrides.lastErrorCode ?? "access_denied",
    lastErrorMessage:
      overrides.lastErrorMessage ??
      "GraphQL error: Access denied for orders field",
    attempts: 1,
    maxAttempts: 5,
    startedAt: new Date("2026-06-21T08:00:00.000Z"),
    coreCompletedAt: null,
    completedAt: overrides.completedAt ?? null,
    fullCompletedAt: null,
    failedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function seedProducts(count: number) {
  const harness = testHarness();

  for (let index = 0; index < count; index += 1) {
    harness.seedProduct({
      shopifyVariantId: `gid://shopify/ProductVariant/${index + 1}`,
      shopifyProductId: `gid://shopify/Product/${index + 1}`,
      title: `Product ${index + 1}`,
    });
  }
}

function seedOrders(count: number) {
  const harness = testHarness();

  for (let index = 0; index < count; index += 1) {
    harness.seedOrder({
      shopifyOrderId: `gid://shopify/Order/${index + 1}`,
      orderName: `#${1000 + index}`,
    });
  }
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
});

describe("F.4.6 Sync Status Service", () => {
  it("1. returns empty database sync state", async () => {
    const status = await getStoreSyncStatus(STORE_ID);

    expect(status).toEqual({
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
    });
  });

  it("2. reports products and inventory synced with counts and timestamps", async () => {
    seedProducts(27);
    seedStoreSyncTimestamps({
      productsAt: new Date("2026-06-21T10:51:00.000Z"),
      inventoryAt: new Date("2026-06-21T12:02:00.000Z"),
    });
    seedOnboarding({
      status: "running",
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "running",
      progressPercent: 85,
    });

    const status = await getStoreSyncStatus(STORE_ID);

    expect(status.products).toEqual({
      synced: true,
      count: 27,
      lastSyncAt: "2026-06-21T10:51:00.000Z",
    });
    expect(status.inventory).toEqual({
      synced: true,
      count: 27,
      lastSyncAt: "2026-06-21T12:02:00.000Z",
    });
    expect(getSyncStatusBadge("completed", status.products, "products")).toBe(
      "Synced",
    );
    expect(formatLastSyncAt(status.products.lastSyncAt)).toContain("Jun 21");
  });

  it("3. reports orders blocked with merchant-safe blockedReason only", async () => {
    seedProducts(27);
    seedStoreSyncTimestamps({
      productsAt: new Date("2026-06-21T10:51:00.000Z"),
      inventoryAt: new Date("2026-06-21T12:02:00.000Z"),
    });
    seedOnboarding({
      status: "running",
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "blocked",
      blockedReason: "access_denied",
    });

    const status = await getStoreSyncStatus(STORE_ID);

    expect(status.orders).toEqual({
      synced: false,
      count: 0,
      lastSyncAt: null,
      blocked: true,
      blockedReason: "order_access_pending",
    });
    expect(status.orders.blockedReason).not.toBe("access_denied");
    expect(getSyncCountLabel(status.orders, "orders", "Blocked")).toBe(
      "Waiting for Shopify approval",
    );
    expect(getOrdersBlockedCopy().primary).not.toContain("GraphQL");
  });

  it("4. reports onboarding running with syncing badges", async () => {
    seedProducts(5);
    seedOnboarding({
      status: "running",
      productSyncStatus: "completed",
      inventorySyncStatus: "running",
      ordersSyncStatus: "not_started",
    });

    const status = await getStoreSyncStatus(STORE_ID);

    expect(status.onboardingStatus).toBe("running");
    expect(getSyncStatusBadge("running", status.inventory, "inventory")).toBe(
      "Syncing",
    );
    expect(getSyncCountLabel(status.inventory, "inventory", "Syncing")).toBe(
      "5 synced",
    );
  });

  it("5. reports onboarding completed and synced orders", async () => {
    seedProducts(10);
    seedOrders(4);
    seedStoreSyncTimestamps({
      productsAt: new Date("2026-06-21T10:51:00.000Z"),
      inventoryAt: new Date("2026-06-21T12:02:00.000Z"),
      ordersAt: new Date("2026-06-21T13:15:00.000Z"),
    });
    seedOnboarding({
      status: "completed",
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "completed",
      completedAt: new Date("2026-06-21T13:15:00.000Z"),
    });

    const status = await getStoreSyncStatus(STORE_ID);

    expect(status.onboardingStatus).toBe("completed");
    expect(status.orders.synced).toBe(true);
    expect(status.orders.count).toBe(4);
    expect(status.orders.blocked).toBe(false);
  });

  it("6. serializes sync status for loader output without internal fields", async () => {
    seedOnboarding({
      status: "running",
      ordersSyncStatus: "blocked",
      blockedReason: "access_denied",
    });

    const status = await getStoreSyncStatus(STORE_ID);
    const serialized = serializeStoreSyncStatusForLoader(status);

    expect(serialized.orders.lastSyncAt).toBeNull();
    expect(serialized).not.toHaveProperty("blockedMessage");
    expect(serialized).not.toHaveProperty("lastErrorMessage");
    expect(serialized).not.toHaveProperty("currentJobId");
    expect(toMerchantBlockedReason("access_denied")).toBe("order_access_pending");
  });
});
