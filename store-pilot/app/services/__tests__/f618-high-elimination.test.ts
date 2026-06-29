import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OnboardingStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import {
  ensureSubscriptionForActiveStore,
  terminateSubscriptionOnUninstall,
} from "../billing.server";
import {
  gatherCustomerDataExport,
  redactCustomerOrders,
  REDACTED_ORDER_NAME,
} from "../gdpr.server";
import {
  JobWorkerOwnershipError,
  claimNextJob,
  completeJob,
  cancelStoreJobsOnUninstall,
} from "../job.server";
import { ensureOrdersSchedulerActive } from "../orders-scheduler.server";
import {
  markOnboardingOwnershipRepairCandidate,
  repairOwnershipConflictOnboarding,
} from "../onboarding.server";
import { syncInventoryFromShopify } from "../inventory.server";
import { getStartupReadiness } from "../startup-readiness.server";
import {
  ensureStoreBackfillAfterReinstall,
  BACKFILL_STALE_MS,
} from "../store-backfill.server";
import { deactivateStoreOnUninstall } from "../store.server";
import {
  evaluateSubscriptionAccess,
} from "../subscription.server";
import {
  buildWebhookActionResponse,
  claimWebhookEvent,
  gateWebhookEvent,
} from "../webhook.server";
import {
  ORDER_GID,
  SHOP,
  STORE_ID,
  lineItemGid,
  testHarness,
} from "./helpers/fixtures";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.18 H1 — reinstall onboarding backfill", () => {
  it("enqueues catch-up jobs when onboarding completed and sync is stale", async () => {
    const harness = testHarness();
    const staleAt = new Date(Date.now() - BACKFILL_STALE_MS - 60_000);

    harness.getStore().lastProductsSyncAt = staleAt;
    harness.getStore().lastInventorySyncAt = staleAt;
    harness.getStore().lastOrdersSyncAt = staleAt;
    harness.getStore().historicalOrdersImportDone = true;

    harness.dbState.storeOnboarding.set(STORE_ID, {
      id: "onboarding-backfill",
      storeId: STORE_ID,
      status: OnboardingStatus.completed,
      onboardingRunId: "run-backfill",
      currentJobId: null,
      productSyncStatus: "completed",
      productSyncJobId: null,
      productSyncCompletedAt: staleAt,
      inventorySyncStatus: "completed",
      inventorySyncJobId: null,
      inventorySyncCompletedAt: staleAt,
      ordersSyncStatus: "completed",
      ordersSyncJobId: null,
      ordersSyncCompletedAt: staleAt,
      blockedReason: null,
      blockedMessage: null,
      degradedReason: null,
      progressPercent: 100,
      progressLabel: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      attempts: 0,
      maxAttempts: 5,
      startedAt: staleAt,
      coreCompletedAt: staleAt,
      completedAt: staleAt,
      fullCompletedAt: staleAt,
      failedAt: null,
      ownershipRepairPending: false,
      createdAt: staleAt,
      updatedAt: staleAt,
    });

    const result = await ensureStoreBackfillAfterReinstall(STORE_ID);

    expect(result.enqueued.length).toBeGreaterThanOrEqual(3);
    expect(result.skipped).not.toContain("onboarding_not_completed");
  });

  it("skips backfill when onboarding is not completed", async () => {
    const result = await ensureStoreBackfillAfterReinstall(STORE_ID);
    expect(result.enqueued).toHaveLength(0);
    expect(result.skipped).toContain("onboarding_not_completed");
  });
});

describe("F.6.18 H2 — trial reinstall loop", () => {
  it("does not grant a second trial after install → uninstall → reinstall", async () => {
    const first = await ensureSubscriptionForActiveStore(STORE_ID);
    expect(first?.status).toBe("trialing");

    await terminateSubscriptionOnUninstall(STORE_ID);
    await deactivateStoreOnUninstall(SHOP);

    const store = testHarness().getStore();
    store.active = true;

    const second = await ensureSubscriptionForActiveStore(STORE_ID);
    expect(second?.status).toBe("cancelled");
    expect(second?.trialEndsAt).toBeNull();
  });
});

describe("F.6.18 H3 — trialing with null trialEndsAt", () => {
  it("blocks access with invalid_trial reason", () => {
    const access = evaluateSubscriptionAccess({
      id: "sub-invalid",
      storeId: STORE_ID,
      planId: "plan-starter-001",
      status: "trialing",
      currentPeriodStart: new Date("2025-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2025-02-01T00:00:00.000Z"),
      trialEndsAt: null,
      plan: {
        id: "plan-starter-001",
        name: "Starter",
        slug: "starter",
        monthlyPrice: 49,
        annualPrice: 490,
        maxProducts: 1000,
        maxOrders: 5000,
        maxTeamMembers: 2,
        aiCreditsPerMonth: 100,
        active: true,
      },
    });

    expect(access.accessState).toBe("blocked");
    expect(access.reason).toBe("invalid_trial");
  });
});

describe("F.6.18 H4/H5 — webhook lease ACK loss", () => {
  it("returns lease_active with retryable instead of duplicate on contention", async () => {
    const first = await claimWebhookEvent({
      storeId: STORE_ID,
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-f618-lease",
    });
    const second = await claimWebhookEvent({
      storeId: STORE_ID,
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-f618-lease",
    });

    expect(first.status).toBe("claimed");
    expect(second.status).toBe("lease_active");
    expect(second.retryable).toBe(true);
  });

  it("returns inactive_retry without claiming webhook for inactive stores", async () => {
    const gate = await gateWebhookEvent({
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-f618-inactive",
      lookup: { storeId: STORE_ID, active: false },
    });

    expect(gate.outcome).toBe("inactive_retry");
    if (gate.outcome === "inactive_retry") {
      expect(gate.retryable).toBe(true);
    }

    const event = await prisma.webhookEvent.findUnique({
      where: { shopifyWebhookId: "wh-f618-inactive" },
    });
    expect(event).toBeNull();
  });

  it("maps lease retry to HTTP 503", () => {
    const response = buildWebhookActionResponse({ retryable: true, reason: "lease_active" });
    expect(response.status).toBe(503);
  });
});

describe("F.6.18 H6 — webhook registration failure aborts bootstrap", () => {
  it("continues subscription bootstrap after webhook registration failure is logged", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/shopify.server.ts"),
      "utf8",
    );

    const failureMarker = source.indexOf("webhook_registration_required");
    const subscriptionMarker = source.indexOf(
      "await ensureSubscriptionForActiveStore(store.id)",
    );

    expect(failureMarker).toBeGreaterThan(-1);
    expect(subscriptionMarker).toBeGreaterThan(failureMarker);
    expect(source).toContain("continuing bootstrap");
  });
});

describe("F.6.18 H7 — customer redact completeness", () => {
  it("redacts order names, line items, and stored export references", async () => {
    const harness = testHarness();
    const order = harness.seedOrder({
      shopifyOrderId: ORDER_GID,
      orderName: "#1001",
    });
    harness.seedOrderLineItem({
      orderId: order.id,
      shopifyLineItemId: lineItemGid(1),
      title: "Sensitive item",
      sku: "SECRET-SKU",
    });

    await prisma.customerDataExport.create({
      data: {
        storeId: STORE_ID,
        shopifyCustomerId: "gid://shopify/Customer/42",
        dataRequestId: "req-1",
        shopifyWebhookId: "wh-export-1",
        exportPayload: { orders: [] },
      },
    });

    const result = await redactCustomerOrders({
      storeId: STORE_ID,
      shopifyCustomerId: "gid://shopify/Customer/42",
      orderGids: [ORDER_GID],
    });

    expect(result.ordersRedacted).toBe(1);
    expect(result.lineItemsRedacted).toBeGreaterThan(0);
    expect(result.exportsRemoved).toBe(1);

    const updatedOrder = harness.getOrder(ORDER_GID);
    expect(updatedOrder?.orderName).toBe(REDACTED_ORDER_NAME);

    const lineItems = harness.getOrderLineItems(order.id);
    expect(lineItems[0]?.title).toBe("[redacted]");
    expect(lineItems[0]?.sku).toBeNull();
  });
});

describe("F.6.18 H8 — customer export least privilege", () => {
  it("exports only customer-linked orders and no webhook metadata", async () => {
    const harness = testHarness();
    harness.seedOrder({ shopifyOrderId: ORDER_GID, orderName: "#1001" });
    harness.seedOrder({
      shopifyOrderId: "gid://shopify/Order/9999",
      orderName: "#9999",
    });

    await prisma.webhookEvent.create({
      data: {
        storeId: STORE_ID,
        shopifyWebhookId: "wh-unrelated",
        shop: SHOP,
        topic: "orders/create",
        processedSuccessfully: true,
      },
    });

    const exportPayload = await gatherCustomerDataExport({
      storeId: STORE_ID,
      shopifyCustomerId: "gid://shopify/Customer/42",
      dataRequestId: "req-1",
      orderGids: [ORDER_GID],
    });

    expect(exportPayload.orders).toHaveLength(1);
    expect(exportPayload.orders[0]?.shopifyOrderId).toBe(ORDER_GID);
    expect(exportPayload.webhookEvents.records).toHaveLength(0);
  });
});

describe("F.6.18 H9 — worker stale lock duplicate execution", () => {
  it("rejects completeJob when workerGeneration mismatches", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "gen-job",
      status: "running",
      lockedBy: "worker-a",
      workerGeneration: 2,
    });

    await expect(
      completeJob({
        jobId: job.id,
        storeId: STORE_ID,
        workerId: "worker-a",
        workerGeneration: 1,
        durationMs: 100,
      }),
    ).rejects.toBeInstanceOf(JobWorkerOwnershipError);
  });

  it("increments workerGeneration when claiming jobs", async () => {
    const harness = testHarness();
    harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "claim-gen",
      status: "queued",
      workerGeneration: 0,
    });

    const claim = await claimNextJob({ workerId: "worker-claim" });
    expect(claim?.workerGeneration).toBe(1);
  });
});

describe("F.6.18 H10 — ownership_conflict onboarding repair", () => {
  it("repairs onboarding marked for ownership conflict without stale lock wait", async () => {
    const harness = testHarness();
    harness.dbState.storeOnboarding.set(STORE_ID, {
      id: "onboarding-repair",
      storeId: STORE_ID,
      status: OnboardingStatus.running,
      onboardingRunId: "run-repair",
      currentJobId: "stale-job",
      productSyncStatus: "running",
      productSyncJobId: "stale-job",
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
      progressLabel: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      attempts: 0,
      maxAttempts: 5,
      startedAt: new Date(),
      coreCompletedAt: null,
      completedAt: null,
      fullCompletedAt: null,
      failedAt: null,
      ownershipRepairPending: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const repaired = await repairOwnershipConflictOnboarding();
    expect(repaired).toBe(1);

    const onboarding = harness.getOnboarding(STORE_ID);
    expect(onboarding?.ownershipRepairPending).toBe(false);
  });

  it("marks onboarding as repair candidate on ownership conflict", async () => {
    const harness = testHarness();
    harness.dbState.storeOnboarding.set(STORE_ID, {
      id: "onboarding-mark-repair",
      storeId: STORE_ID,
      status: OnboardingStatus.running,
      onboardingRunId: "run-mark",
      currentJobId: "job-1",
      productSyncStatus: "running",
      productSyncJobId: "job-1",
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
      progressPercent: 0,
      progressLabel: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      attempts: 0,
      maxAttempts: 5,
      startedAt: new Date(),
      coreCompletedAt: null,
      completedAt: null,
      fullCompletedAt: null,
      failedAt: null,
      ownershipRepairPending: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await markOnboardingOwnershipRepairCandidate(STORE_ID, "job-conflict");
    const onboarding = harness.getOnboarding(STORE_ID);
    expect(onboarding?.ownershipRepairPending).toBe(true);
    expect(onboarding?.currentJobId).toBeNull();
  });
});

describe("F.6.18 H11 — uninstall cancels jobs", () => {
  it("cancels queued and running jobs and clears onboarding job refs", async () => {
    const harness = testHarness();
    const queued = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "uninstall-queued",
      status: "queued",
    });
    const running = harness.seedSyncJob({
      jobType: "bootstrap_inventory",
      idempotencyKey: "uninstall-running",
      status: "running",
      lockedBy: "worker-1",
    });

    harness.dbState.storeOnboarding.set(STORE_ID, {
      id: "onboarding-uninstall",
      storeId: STORE_ID,
      status: OnboardingStatus.running,
      onboardingRunId: "run-uninstall",
      currentJobId: running.id,
      productSyncStatus: "running",
      productSyncJobId: running.id,
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
      progressPercent: 0,
      progressLabel: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      attempts: 0,
      maxAttempts: 5,
      startedAt: new Date(),
      coreCompletedAt: null,
      completedAt: null,
      fullCompletedAt: null,
      failedAt: null,
      ownershipRepairPending: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const cancelled = await cancelStoreJobsOnUninstall(STORE_ID);
    expect(cancelled).toBe(2);

    expect(harness.dbState.syncJobs.get(queued.id)?.status).toBe("cancelled");
    expect(harness.dbState.syncJobs.get(running.id)?.status).toBe("cancelled");

    const onboarding = harness.getOnboarding(STORE_ID);
    expect(onboarding?.currentJobId).toBeNull();
  });
});

describe("F.6.18 H12 — inventory bootstrap false success", () => {
  it("reports success=false when skipped rows remain", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/8001",
      shopifyInventoryItemId: "gid://shopify/InventoryItem/8001",
      inventoryTracked: true,
    });

    harness.mockAdminGraphql.mockResolvedValue(
      Response.json({
        data: {
          inventoryItem: null,
        },
      }),
    );

    const result = await syncInventoryFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.skipped).toBeGreaterThan(0);
    expect(result.success).toBe(false);
  });
});

describe("F.6.18 H13 — incremental scheduling coverage", () => {
  it("ensureOrdersSchedulerActive schedules when onboarding completed", async () => {
    const harness = testHarness();
    harness.dbState.storeOnboarding.set(STORE_ID, {
      id: "onboarding-scheduler",
      storeId: STORE_ID,
      status: OnboardingStatus.completed,
      onboardingRunId: "run-scheduler",
      currentJobId: null,
      productSyncStatus: "completed",
      productSyncJobId: null,
      productSyncCompletedAt: new Date(),
      inventorySyncStatus: "completed",
      inventorySyncJobId: null,
      inventorySyncCompletedAt: new Date(),
      ordersSyncStatus: "completed",
      ordersSyncJobId: null,
      ordersSyncCompletedAt: new Date(),
      blockedReason: null,
      blockedMessage: null,
      degradedReason: null,
      progressPercent: 100,
      progressLabel: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      attempts: 0,
      maxAttempts: 5,
      startedAt: new Date(),
      coreCompletedAt: new Date(),
      completedAt: new Date(),
      fullCompletedAt: new Date(),
      failedAt: null,
      ownershipRepairPending: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await ensureOrdersSchedulerActive(STORE_ID);
    expect(result.scheduled).toBe(true);
  });
});

describe("F.6.18 H14 — production dependency hardening", () => {
  it("reports startup readiness checks including migration status", async () => {
    const readiness = await getStartupReadiness({
      CRON_SECRET: "secret",
      SHOPIFY_API_KEY: "key",
      DATABASE_URL: "postgres://localhost/test",
      SHOPIFY_APP_URL: "https://app.example.com",
      SHOPIFY_API_SECRET: "secret",
      SCOPES: "read_products,read_inventory,write_products,read_orders",
      TOKEN_ENCRYPTION_KEY: "test-token-encryption-key",
    });

    expect(readiness.checks.some((check) => check.id === "migrations")).toBe(true);
    expect(readiness.checks.some((check) => check.id === "cron_secret")).toBe(true);
    expect(readiness.checks.some((check) => check.id === "worker_queue")).toBe(true);
    expect(readiness.checks.some((check) => check.id === "webhook_registration_config")).toBe(
      true,
    );
    expect(readiness.ready).toBe(true);
  });

  it("marks startup not ready when CRON_SECRET is missing", async () => {
    const readiness = await getStartupReadiness({
      CRON_SECRET: "",
      SHOPIFY_API_KEY: "key",
      DATABASE_URL: "postgres://localhost/test",
      SHOPIFY_APP_URL: "https://app.example.com",
      SHOPIFY_API_SECRET: "secret",
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.checks.find((check) => check.id === "cron_secret")?.ok).toBe(false);
  });
});
