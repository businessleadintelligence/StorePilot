import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ORDER_GID,
  PRODUCT_GID,
  SHOP,
  STORE_ID,
  VARIANT_GID,
  VARIANT_GID_2,
  buildOrderNode,
  mockOrdersSyncPageResponse,
  mockProductsSyncGraphqlResponse,
  testHarness,
} from "./helpers/fixtures";
import { createTrialSubscription } from "../billing.server";
import { getResolvedPlanLimit } from "../../billing/plan-registry";
import { BILLING_LIMIT_EXCEEDED } from "../billing-enforcement.server";
import type { OrderNode } from "../orders.server";
import {
  normalizeOrderRow,
  syncOrdersFromShopify,
  upsertOrderRow,
} from "../orders.server";
import {
  normalizeVariantRow,
  syncProductsFromShopify,
  upsertVariantRow,
} from "../product.server";
import * as ordersServer from "../orders.server";
import * as productServer from "../product.server";
import { runNextJob } from "../worker.server";

const productNode = {
  id: PRODUCT_GID,
  title: "Test Product",
  status: "ACTIVE",
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

const newVariantNode = {
  id: VARIANT_GID_2,
  sku: "SKU-2",
  price: "29.99",
  inventoryQuantity: 5,
  inventoryItem: {
    id: "gid://shopify/InventoryItem/124",
    tracked: true,
  },
};

function asOrderNode(value: Record<string, unknown>): OrderNode {
  return value as OrderNode;
}

function seedProducts(count: number) {
  const harness = testHarness();

  for (let index = 0; index < count; index += 1) {
    harness.seedProduct({
      shopifyVariantId: `gid://shopify/ProductVariant/bill-prod-${index}`,
    });
  }
}

function seedOrders(count: number) {
  const harness = testHarness();

  for (let index = 0; index < count; index += 1) {
    harness.seedOrder({
      shopifyOrderId: `gid://shopify/Order/bill-order-${index}`,
    });
  }
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const STARTER_PRODUCT_LIMIT = getResolvedPlanLimit("starter", "products");

describe("F.6.1B FIX-B1 — billing enforcement", () => {
  describe("Product enforcement", () => {
    it("blocks new variant creates at plan limit but allows updates", async () => {
      await createTrialSubscription(STORE_ID, "starter");
      seedProducts(STARTER_PRODUCT_LIMIT);

      const harness = testHarness();
      const newRow = normalizeVariantRow(productNode, newVariantNode);
      expect(newRow).not.toBeNull();

      const blocked = await upsertVariantRow(STORE_ID, newRow!, "sync");
      expect(blocked).toEqual({ action: "limit_exceeded" });
      expect(harness.dbState.products.size).toBe(STARTER_PRODUCT_LIMIT);

      harness.seedProduct({ shopifyVariantId: VARIANT_GID });
      const existingRow = normalizeVariantRow(productNode, trackedVariantNode);
      const updated = await upsertVariantRow(STORE_ID, existingRow!, "sync");
      expect(updated).toEqual({ action: "updated" });
    });

    it("returns blocked sync result when historical product import hits limit", async () => {
      await createTrialSubscription(STORE_ID, "starter");
      seedProducts(STARTER_PRODUCT_LIMIT);

      const harness = testHarness();
      harness.mockAdminGraphql.mockResolvedValue(
        mockProductsSyncGraphqlResponse({
          inventoryQuantity: 8,
          tracked: true,
        }),
      );

      const result = await syncProductsFromShopify({
        storeId: STORE_ID,
        shop: SHOP,
        admin: { graphql: harness.mockAdminGraphql },
      });

      expect(result).toMatchObject({
        success: false,
        blocked: true,
        blockedReason: BILLING_LIMIT_EXCEEDED,
      });
      expect(harness.getStore().lastProductsSyncAt).toBeNull();
      expect(harness.dbState.products.size).toBe(STARTER_PRODUCT_LIMIT);
    });
  });

  describe("Order enforcement", () => {
    it("blocks new order creates at plan limit but allows updates", async () => {
      await createTrialSubscription(STORE_ID, "starter");
      seedOrders(5000);

      const harness = testHarness();
      const normalized = normalizeOrderRow(asOrderNode(buildOrderNode()), {
        shop: SHOP,
        storeId: STORE_ID,
      });
      expect(normalized).not.toBeNull();

      const blocked = await upsertOrderRow(STORE_ID, normalized!);
      expect(blocked).toMatchObject({
        orderId: null,
        created: false,
        limitExceeded: true,
      });
      expect(harness.dbState.orders.size).toBe(5000);

      harness.seedOrder({ shopifyOrderId: ORDER_GID });
      const updated = await upsertOrderRow(STORE_ID, {
        ...normalized!,
        orderName: "#1001-updated",
        shopifyUpdatedAt: new Date("2026-01-16T10:00:00Z"),
      });
      expect(updated).toMatchObject({
        created: false,
        orderId: harness.getOrder(ORDER_GID)?.id,
      });
      expect(harness.getOrder(ORDER_GID)?.orderName).toBe("#1001-updated");
    });

    it("returns blocked sync result when historical order import hits limit", async () => {
      await createTrialSubscription(STORE_ID, "starter");
      seedOrders(5000);

      const harness = testHarness();
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

      expect(result).toMatchObject({
        success: false,
        blocked: true,
        blockedReason: BILLING_LIMIT_EXCEEDED,
      });
      expect(harness.getStore().historicalOrdersImportDone).toBe(false);
      expect(harness.getStore().lastOrdersSyncAt).toBeNull();
      expect(harness.dbState.orders.size).toBe(5000);
    });

    it("still upserts existing orders when plan limit is reached", async () => {
      await createTrialSubscription(STORE_ID, "starter");
      seedOrders(5000);
      testHarness().seedOrder({ shopifyOrderId: ORDER_GID, orderName: "#1001-old" });

      const harness = testHarness();
      harness.mockAdminGraphql.mockResolvedValue(
        mockOrdersSyncPageResponse({
          orders: [
            buildOrderNode({
              name: "#1001-new",
              updatedAt: "2026-01-16T10:00:00Z",
            }),
          ],
        }),
      );

      const result = await syncOrdersFromShopify({
        storeId: STORE_ID,
        shop: SHOP,
        admin: { graphql: harness.mockAdminGraphql },
      });

      expect(result.blocked).toBeUndefined();
      expect(result.success).toBe(true);
      expect(harness.getOrder(ORDER_GID)?.orderName).toBe("#1001-new");
      expect(harness.dbState.orders.size).toBe(5001);
    });
  });

  describe("Worker handling", () => {
    it("completes bootstrap_products as blocked when product limit is reached", async () => {
      const harness = testHarness();
      const job = harness.seedSyncJob({
        jobType: "bootstrap_products",
        idempotencyKey: "bootstrap-products-limit",
        status: "queued",
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

      vi.spyOn(productServer, "syncProductsFromShopify").mockResolvedValue({
        success: false,
        blocked: true,
        blockedReason: BILLING_LIMIT_EXCEEDED,
        blockedMessage: `Product plan limit reached (${STARTER_PRODUCT_LIMIT}/${STARTER_PRODUCT_LIMIT})`,
        productPages: 1,
        productsProcessed: STARTER_PRODUCT_LIMIT,
        variantsProcessed: STARTER_PRODUCT_LIMIT,
        upserted: 0,
        skipped: 1,
      });

      const processed = await runNextJob("worker-products-limit");

      expect(processed).toMatchObject({
        jobId: job.id,
        jobType: "bootstrap_products",
        status: "blocked",
      });

      const storedJob = harness.dbState.syncJobs.get(job.id);
      expect(storedJob?.status).toBe("completed");
      expect(storedJob?.failedAt).toBeNull();
      expect(storedJob?.deadLetterAt).toBeNull();
      expect(harness.dbState.storeOnboarding.get(STORE_ID)?.productSyncStatus).toBe(
        "blocked",
      );
      expect(harness.dbState.storeOnboarding.get(STORE_ID)?.blockedReason).toBe(
        BILLING_LIMIT_EXCEEDED,
      );
    });

    it("completes orders_historical as blocked when order limit is reached", async () => {
      const harness = testHarness();
      const job = harness.seedSyncJob({
        jobType: "orders_historical",
        idempotencyKey: "orders-historical-limit",
        status: "queued",
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
        inventorySyncStatus: "completed",
        inventorySyncJobId: null,
        inventorySyncCompletedAt: new Date(),
        ordersSyncStatus: "running",
        ordersSyncJobId: job.id,
        ordersSyncCompletedAt: null,
        blockedReason: null,
        blockedMessage: null,
        degradedReason: null,
        progressPercent: 90,
        progressLabel: "Syncing orders",
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

      vi.spyOn(ordersServer, "syncOrdersFromShopify").mockResolvedValue({
        success: false,
        blocked: true,
        blockedReason: BILLING_LIMIT_EXCEEDED,
        blockedMessage: "Order plan limit reached (5000/5000)",
        orderPages: 1,
        ordersProcessed: 1,
        lineItemsProcessed: 1,
        upserted: 0,
        skipped: 1,
      });

      const processed = await runNextJob("worker-orders-limit");

      expect(processed?.status).toBe("blocked");
      expect(harness.dbState.storeOnboarding.get(STORE_ID)?.ordersSyncStatus).toBe(
        "blocked",
      );
      expect(harness.dbState.storeOnboarding.get(STORE_ID)?.blockedReason).toBe(
        BILLING_LIMIT_EXCEEDED,
      );
    });

    it("completes orders_incremental as blocked without retry or dead letter", async () => {
      const harness = testHarness();
      const job = harness.seedSyncJob({
        jobType: "orders_incremental",
        idempotencyKey: "orders-incremental-limit",
        status: "queued",
      });

      vi.spyOn(ordersServer, "syncOrdersIncremental").mockResolvedValue({
        success: false,
        blocked: true,
        blockedReason: BILLING_LIMIT_EXCEEDED,
        blockedMessage: "Order plan limit reached (5000/5000)",
        orderPages: 1,
        ordersProcessed: 1,
        lineItemsProcessed: 1,
        upserted: 0,
        skipped: 1,
      });

      const processed = await runNextJob("worker-incremental-limit");

      expect(processed).toMatchObject({
        jobId: job.id,
        jobType: "orders_incremental",
        status: "blocked",
      });

      const storedJob = harness.dbState.syncJobs.get(job.id);
      expect(storedJob?.status).toBe("completed");
      expect(storedJob?.failedAt).toBeNull();
      expect(storedJob?.deadLetterAt).toBeNull();
    });
  });
});
