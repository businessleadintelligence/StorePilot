import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ORDER_GID,
  PRODUCT_GID,
  SHOP,
  STORE_ID,
  VARIANT_GID,
  VARIANT_GID_2,
  buildOrderNode,
  mockInventoryGraphqlResponse,
  mockOrdersSyncPageResponse,
  mockProductByIdResponse,
  mockProductsSyncGraphqlResponse,
  testHarness,
} from "./helpers/fixtures";
import { handleInventoryLevelUpdateWebhook } from "../inventory.server";
import { failJobWithClient } from "../job.server";
import {
  normalizeOrderRow,
  syncOrdersFromShopify,
  upsertOrderRow,
} from "../orders.server";
import {
  finalizeFailedOnboardingJob,
  reconcileOnboardingWithCompletedJobs,
} from "../onboarding.server";
import {
  normalizeVariantRow,
  upsertVariantRow,
} from "../product.server";

const productNode = {
  id: PRODUCT_GID,
  title: "Test Product",
  status: "ACTIVE",
  updatedAt: "2026-06-20T12:00:00Z",
  variants: { pageInfo: { hasNextPage: false } },
};

const trackedVariantNode = {
  id: VARIANT_GID,
  sku: "SKU-1",
  price: "19.99",
  inventoryQuantity: 3,
  inventoryItem: {
    id: "gid://shopify/InventoryItem/123",
    tracked: true,
  },
};

function inventoryWebhookInput(webhookId: string) {
  return {
    shop: SHOP,
    topic: "INVENTORY_LEVELS_UPDATE",
    webhookId,
    payload: {
      inventory_item_id: 123,
      location_id: 1,
      available: 15,
    },
  };
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.4 FIX-C2", () => {
  it("1. historical orders sync resumes from saved cursor", async () => {
    const harness = testHarness();
    harness.getStore().ordersSyncCursor = "historical-resume-cursor";

    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [buildOrderNode()],
      }),
    );

    await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(harness.mockAdminGraphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        variables: expect.objectContaining({
          cursor: "historical-resume-cursor",
        }),
      }),
    );
  });

  it("2. historical orders sync clears cursor on successful completion", async () => {
    const harness = testHarness();
    harness.getStore().ordersSyncCursor = "historical-resume-cursor";

    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [buildOrderNode()],
      }),
    );

    const result = await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(true);
    expect(harness.getStore().ordersSyncCursor).toBeNull();
    expect(harness.getStore().historicalOrdersImportDone).toBe(true);
  });

  it("3. stale product update is skipped", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID,
      title: "Fresh Title",
      shopifyProductUpdatedAt: new Date("2026-06-20T13:00:00Z"),
    });

    const row = normalizeVariantRow(productNode, trackedVariantNode);
    expect(row).not.toBeNull();

    const result = await upsertVariantRow(STORE_ID, row!, "sync");

    expect(result.action).toBe("stale_skipped");
    expect(harness.getProduct(VARIANT_GID)?.title).toBe("Fresh Title");
  });

  it("4. stale order update is skipped", async () => {
    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: ORDER_GID,
      shopifyUpdatedAt: new Date("2026-06-20T13:00:00Z"),
      orderName: "#1001-fresh",
    });

    const normalized = normalizeOrderRow(
      buildOrderNode({ updatedAt: "2026-06-20T12:00:00Z" }) as never,
      { shop: SHOP, storeId: STORE_ID },
    );
    expect(normalized).not.toBeNull();

    const result = await upsertOrderRow(STORE_ID, normalized!);

    expect(result.staleSkipped).toBe(true);
    expect(harness.getOrder(ORDER_GID)?.orderName).toBe("#1001-fresh");
  });

  it("5. dead-letter onboarding job is repaired automatically", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "bootstrap-dead-letter",
      status: "dead_letter",
      attempts: 5,
      errorMessage: "shopify_timeout",
    });

    harness.dbState.storeOnboarding.set(STORE_ID, {
      id: crypto.randomUUID(),
      storeId: STORE_ID,
      onboardingRunId: crypto.randomUUID(),
      status: "running",
      currentJobId: job.id,
      productSyncStatus: "running",
      productSyncJobId: job.id,
      productSyncCompletedAt: null,
      inventorySyncStatus: "not_started",
      inventorySyncJobId: null,
      inventorySyncCompletedAt: null,
      ordersSyncStatus: "not_started",
      ordersSyncJobId: null,
      ordersSyncCompletedAt: null,
      blockedReason: null,
      blockedMessage: null,
      degradedReason: null,
      progressPercent: 10,
      progressLabel: "Syncing products",
      lastErrorCode: null,
      lastErrorMessage: null,
      attempts: 0,
      maxAttempts: 5,
      startedAt: new Date(),
      coreCompletedAt: null,
      completedAt: null,
      fullCompletedAt: null,
      failedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const repaired = await reconcileOnboardingWithCompletedJobs();

    expect(repaired).toBe(1);
    expect(harness.dbState.storeOnboarding.get(STORE_ID)?.productSyncStatus).toBe(
      "failed",
    );
    expect(harness.dbState.storeOnboarding.get(STORE_ID)?.status).toBe("failed");
  });

  it("6. cancelled onboarding job is repaired automatically", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_inventory",
      idempotencyKey: "inventory-cancelled",
      status: "cancelled",
      attempts: 1,
      errorMessage: "job_cancelled",
    });

    harness.dbState.storeOnboarding.set(STORE_ID, {
      id: crypto.randomUUID(),
      storeId: STORE_ID,
      onboardingRunId: crypto.randomUUID(),
      status: "running",
      currentJobId: job.id,
      productSyncStatus: "completed",
      productSyncJobId: null,
      productSyncCompletedAt: new Date(),
      inventorySyncStatus: "running",
      inventorySyncJobId: job.id,
      inventorySyncCompletedAt: null,
      ordersSyncStatus: "not_started",
      ordersSyncJobId: null,
      ordersSyncCompletedAt: null,
      blockedReason: null,
      blockedMessage: null,
      degradedReason: null,
      progressPercent: 40,
      progressLabel: "Syncing inventory",
      lastErrorCode: null,
      lastErrorMessage: null,
      attempts: 0,
      maxAttempts: 5,
      startedAt: new Date(),
      coreCompletedAt: null,
      completedAt: null,
      fullCompletedAt: null,
      failedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const repaired = await reconcileOnboardingWithCompletedJobs();

    expect(repaired).toBe(1);
    expect(harness.dbState.storeOnboarding.get(STORE_ID)?.inventorySyncStatus).toBe(
      "failed",
    );
  });

  it("7. missing inventory GraphQL item is retriable", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID,
      inventoryTracked: true,
    });

    harness.mockAdminGraphql.mockResolvedValue(
      Response.json({
        data: {
          inventoryItem: null,
        },
      }),
    );

    await expect(
      handleInventoryLevelUpdateWebhook(
        inventoryWebhookInput("wh-c2-inventory-missing"),
      ),
    ).rejects.toThrow(
      "retriable_inventory_webhook_skip:inventory_item_not_found_in_graphql",
    );

    expect(
      harness.dbState.webhookEvents.get("wh-c2-inventory-missing")
        ?.processedSuccessfully,
    ).toBe(false);
  });

  it("8. inventory webhook with updated=0 is retriable", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID,
      inventoryTracked: true,
      shopifyInventoryItemId: "gid://shopify/InventoryItem/123",
    });

    harness.mockAdminGraphql.mockResolvedValue(
      mockInventoryGraphqlResponse({
        tracked: true,
        totalAvailable: 15,
      }),
    );

    vi.spyOn(harness.prismaMock.product, "updateMany")
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      handleInventoryLevelUpdateWebhook(
        inventoryWebhookInput("wh-c2-inventory-zero-updated"),
      ),
    ).rejects.toThrow(
      "retriable_inventory_webhook_skip:inventory_quantity_not_updated",
    );
  });

  it("9. finalizeFailedOnboardingJob atomically fails job and onboarding phase", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "bootstrap-atomic-fail",
      status: "running",
      attempts: 5,
      maxAttempts: 5,
      lockedBy: "worker-atomic",
    });

    harness.dbState.storeOnboarding.set(STORE_ID, {
      id: crypto.randomUUID(),
      storeId: STORE_ID,
      onboardingRunId: crypto.randomUUID(),
      status: "running",
      currentJobId: job.id,
      productSyncStatus: "running",
      productSyncJobId: job.id,
      productSyncCompletedAt: null,
      inventorySyncStatus: "not_started",
      inventorySyncJobId: null,
      inventorySyncCompletedAt: null,
      ordersSyncStatus: "not_started",
      ordersSyncJobId: null,
      ordersSyncCompletedAt: null,
      blockedReason: null,
      blockedMessage: null,
      degradedReason: null,
      progressPercent: 10,
      progressLabel: "Syncing products",
      lastErrorCode: null,
      lastErrorMessage: null,
      attempts: 0,
      maxAttempts: 5,
      startedAt: new Date(),
      coreCompletedAt: null,
      completedAt: null,
      fullCompletedAt: null,
      failedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { job: failedJob, markedFailed } = await finalizeFailedOnboardingJob({
      jobId: job.id,
      storeId: STORE_ID,
      workerId: "worker-atomic",
      phase: "PRODUCTS",
      errorCode: "worker_execution_failed",
      errorMessage: "shopify_timeout",
    });

    expect(markedFailed).toBe(true);
    expect(failedJob.status).toBe("dead_letter");
    expect(harness.dbState.storeOnboarding.get(STORE_ID)?.productSyncStatus).toBe(
      "failed",
    );
    expect(harness.dbState.storeOnboarding.get(STORE_ID)?.currentJobId).toBeNull();
  });

  it("fresh product update applies when Shopify timestamp is newer", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID,
      title: "Old Title",
      shopifyProductUpdatedAt: new Date("2026-06-20T11:00:00Z"),
    });

    const row = normalizeVariantRow(
      {
        ...productNode,
        updatedAt: "2026-06-20T13:00:00Z",
      },
      trackedVariantNode,
    );
    expect(row).not.toBeNull();

    const result = await upsertVariantRow(STORE_ID, row!, "sync");

    expect(result.action).toBe("updated");
    expect(harness.getProduct(VARIANT_GID)?.title).toBe("Test Product");
  });

  it("10. product create P2002 race returns idempotent updated result", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID_2,
      shopifyProductUpdatedAt: new Date("2026-06-20T11:00:00Z"),
    });

    let findCalls = 0;
    vi.spyOn(harness.prismaMock.product, "findUnique").mockImplementation(
      async (args) => {
        findCalls += 1;
        if (findCalls === 1) {
          return null;
        }

        return harness.getProduct(VARIANT_GID_2) ?? null;
      },
    );

    vi.spyOn(harness.prismaMock.product, "create").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const row = normalizeVariantRow(productNode, {
      ...trackedVariantNode,
      id: VARIANT_GID_2,
    });
    expect(row).not.toBeNull();

    const result = await upsertVariantRow(STORE_ID, row!, "webhook");

    expect(result.action).toBe("updated");
    expect(harness.dbState.products.size).toBe(1);
  });

  it("persists historical cursor after each page when more pages remain", async () => {
    const harness = testHarness();

    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [buildOrderNode()],
        hasNextPage: true,
        endCursor: "historical-page-2",
      }),
    );

    const result = await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(false);
    expect(harness.getStore().ordersSyncCursor).toBe("historical-page-2");
    expect(harness.getStore().historicalOrdersImportDone).toBe(false);
  });
});
