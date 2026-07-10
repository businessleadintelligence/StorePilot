import { BILLING_CONFIG } from "../../billing/plan-config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ORDER_GID,
  SHOP,
  STORE_ID,
  buildOrderNode,
  seedUsageMetricForTests,
  testHarness,
} from "./helpers/fixtures";
import { consumeAiCredits, getAiBudgetStatus } from "../ai-cost-control.server";
import {
  createTrialSubscription,
  getCurrentUsageMonth,
  recordUsage,
  tryIncrementAiCreditsWithinLimit,
} from "../billing.server";
import { BILLING_LIMIT_EXCEEDED } from "../billing-enforcement.server";
import { recordUsageIfAllowed } from "../entitlements.server";
import {
  advanceOnboarding,
  finalizeBlockedJobPhase,
  getOrCreateStoreOnboarding,
} from "../onboarding.server";
import type { OrderNode } from "../orders.server";
import {
  normalizeOrderRow,
  syncOrdersFromShopify,
  upsertOrderWithLineItems,
} from "../orders.server";
import * as ordersServer from "../orders.server";
import { runNextJob } from "../worker.server";

const STARTER_AI_LIMIT = BILLING_CONFIG.limits.starter.aiExecutions;

function asOrderNode(value: Record<string, unknown>): OrderNode {
  return value as OrderNode;
}

function normalizedOrderFromNode(order: OrderNode) {
  return normalizeOrderRow(order, { shop: SHOP, storeId: STORE_ID })!;
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.6 FIX-D1", () => {
  it("1. migration adds Product.shopifyProductUpdatedAt", () => {
    const migrationPath = join(
      process.cwd(),
      "prisma",
      "migrations",
      "20260622120000_add_product_shopify_updated_at",
      "migration.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain('"shopifyProductUpdatedAt"');
    expect(sql).toContain("ALTER TABLE");
    expect(sql).toContain('"products"');
  });

  it("2. AI atomic debit uses storeId column and locks shared metrics", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const month = getCurrentUsageMonth();
    const harness = testHarness();

    seedUsageMetricForTests(STORE_ID, "reports_generated", STARTER_AI_LIMIT - 30, month);

    const debit = await tryIncrementAiCreditsWithinLimit(
      STORE_ID,
      70,
      STARTER_AI_LIMIT,
      month,
      "ai_requests",
    );

    expect(debit).toEqual({ ok: false, reason: "budget_exceeded" });

    const queryCall = harness.prismaMock.$queryRaw.mock.calls.find((call) => {
      const sql = (call[0] as TemplateStringsArray).join(" ");
      return sql.includes("usage_records") && sql.includes("FOR UPDATE");
    });

    expect(queryCall).toBeDefined();
    const sql = (queryCall![0] as TemplateStringsArray).join(" ");
    expect(sql).toContain('"storeId"');
    expect(sql).toContain("reports_generated");
    expect(sql).toContain("ai_requests");
  });

  it("3. shared AI credit pool blocks consumeAiCredits after reports usage", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const month = getCurrentUsageMonth();

    await seedUsageMetricForTests(STORE_ID, "reports_generated", STARTER_AI_LIMIT - 5, month);

    const blocked = await consumeAiCredits(STORE_ID, 10);

    expect(blocked).toMatchObject({
      allowed: false,
      consumed: 0,
      used: STARTER_AI_LIMIT - 5,
      remaining: 5,
      reason: "budget_exceeded",
    });

    expect(await recordUsage(STORE_ID, "reports_generated", 1, month)).toBeNull();
  });

  it("4. recordUsageIfAllowed reports_generated respects shared pool atomically", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const month = getCurrentUsageMonth();

    await seedUsageMetricForTests(STORE_ID, "ai_requests", STARTER_AI_LIMIT - 2, month);

    const result = await recordUsageIfAllowed(STORE_ID, "reports_generated", 5);

    expect(result).toMatchObject({
      allowed: false,
      recorded: false,
      reason: "limit_exceeded",
    });

    const status = await getAiBudgetStatus(STORE_ID);
    expect(status.used).toBe(STARTER_AI_LIMIT - 2);
  });

  it("5. historical orders sync reports incomplete success when orders are skipped", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      Response.json({
        data: {
          orders: {
            edges: [
              { node: buildOrderNode() },
              {
                node: buildOrderNode({
                  id: "gid://shopify/Order/1002",
                  name: "#1002",
                  processedAt: null,
                }),
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
    );

    const result = await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(false);
    expect(result.skipped).toBeGreaterThan(0);
    expect(harness.getStore().historicalOrdersImportDone).toBe(false);
  });

  it("6. orders_historical worker does not complete onboarding when sync is incomplete", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "orders_historical",
      idempotencyKey: "orders-historical-incomplete",
      status: "queued",
      priority: "critical",
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
      orderPages: 1,
      ordersProcessed: 2,
      lineItemsProcessed: 2,
      upserted: 1,
      skipped: 1,
    });

    const processed = await runNextJob("worker-orders-incomplete");

    expect(processed?.status).not.toBe("completed");
    expect(harness.dbState.storeOnboarding.get(STORE_ID)?.ordersSyncStatus).not.toBe(
      "completed",
    );
    expect(harness.dbState.storeOnboarding.get(STORE_ID)?.status).not.toBe(
      "completed",
    );
  });

  it("7. stale order webhook path skips line item writes", async () => {
    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: ORDER_GID,
      shopifyUpdatedAt: new Date("2026-06-20T13:00:00Z"),
      orderName: "#1001-fresh",
    });

    const normalizedOrder = normalizedOrderFromNode(
      asOrderNode(
        buildOrderNode({
          updatedAt: "2026-06-20T12:00:00Z",
          name: "#1001-stale",
        }),
      ),
    );
    const lineItem = {
      shopifyLineItemId: "gid://shopify/LineItem/1",
      shopifyOrderId: ORDER_GID,
      shopifyProductId: null,
      shopifyVariantId: null,
      sku: "SKU-1",
      title: "Stale Line Item",
      quantity: 1,
      originalUnitPrice: "10.00",
      discountedUnitPrice: "10.00",
      isGiftCard: false,
    };

    const upsertLineItemSpy = vi.spyOn(ordersServer, "upsertOrderLineItemRow");

    const result = await upsertOrderWithLineItems(
      STORE_ID,
      normalizedOrder,
      [lineItem],
    );

    expect(result.staleSkipped).toBe(true);
    expect(result.lineItemsUpserted).toBe(0);
    expect(upsertLineItemSpy).not.toHaveBeenCalled();
    expect(harness.getOrder(ORDER_GID)?.orderName).toBe("#1001-fresh");
    expect(harness.getOrderLineItems(harness.getOrder(ORDER_GID)!.id)).toHaveLength(
      0,
    );
  });

  it("8. product billing-block advances onboarding to inventory", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    const advance = await advanceOnboarding({ storeId: STORE_ID });
    const harness = testHarness();
    const productsJobId = advance.jobId;
    expect(productsJobId).toBeTruthy();

    const productsJob = harness.dbState.syncJobs.get(productsJobId!);
    expect(productsJob).toBeDefined();
    harness.dbState.syncJobs.set(productsJobId!, {
      ...productsJob!,
      status: "running",
      lockedBy: "worker-products-blocked",
    });

    const result = await finalizeBlockedJobPhase({
      jobId: productsJobId!,
      storeId: STORE_ID,
      workerId: "worker-products-blocked",
      phase: "PRODUCTS",
      blockedReason: BILLING_LIMIT_EXCEEDED,
      blockedMessage: "Product plan limit reached (1000/1000)",
    });

    const onboarding = harness.getOnboarding(STORE_ID);

    expect(onboarding?.productSyncStatus).toBe("blocked");
    expect(onboarding?.inventorySyncStatus).toBe("queued");
    expect(result.phase).toBe("INVENTORY");
    expect(harness.dbState.syncJobs.size).toBe(2);
    expect(
      [...harness.dbState.syncJobs.values()].some(
        (job) => job.jobType === "bootstrap_inventory",
      ),
    ).toBe(true);
  });
});
