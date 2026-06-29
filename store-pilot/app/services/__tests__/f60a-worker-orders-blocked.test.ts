import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ORDER_GID,
  SHOP,
  STORE_ID,
  mockGraphqlErrorResponse,
  testHarness,
} from "./helpers/fixtures";
import * as ordersServer from "../orders.server";
import { runNextJob } from "../worker.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.0A FIX2 Issue 4 — orders blocked parity", () => {
  it("returns blocked result for incremental sync on permanent access failure", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      mockGraphqlErrorResponse("Access denied for orders field"),
    );

    const result = await ordersServer.syncOrdersIncremental({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result).toMatchObject({
      success: false,
      blocked: true,
      blockedReason: "access_denied",
    });
    expect(harness.getStore().ordersSyncCursor).toBeNull();
  });

  it("worker completes orders_incremental as blocked instead of retry loop", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "orders_incremental",
      idempotencyKey: "orders-incremental-blocked",
      status: "queued",
    });

    vi.spyOn(ordersServer, "syncOrdersIncremental").mockResolvedValue({
      success: false,
      blocked: true,
      blockedReason: "insufficient_scope",
      blockedMessage: "Missing read_orders scope",
      orderPages: 0,
      ordersProcessed: 0,
      lineItemsProcessed: 0,
      upserted: 0,
      skipped: 0,
    });

    const processed = await runNextJob("worker-blocked-test");

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

  it("worker still blocks orders_historical through onboarding finalize path", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "orders_historical",
      idempotencyKey: "orders-historical-blocked",
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
      blockedReason: "protected_customer_data",
      blockedMessage: "Protected customer data approval required",
      orderPages: 0,
      ordersProcessed: 0,
      lineItemsProcessed: 0,
      upserted: 0,
      skipped: 0,
    });

    const processed = await runNextJob("worker-historical-blocked");

    expect(processed?.status).toBe("blocked");
    expect(harness.dbState.storeOnboarding.get(STORE_ID)?.ordersSyncStatus).toBe(
      "blocked",
    );
  });
});
