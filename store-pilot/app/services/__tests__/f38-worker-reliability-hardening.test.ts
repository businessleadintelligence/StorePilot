import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  DEFAULT_LOCK_DURATION_MS,
  extendJobLock,
  heartbeatJob,
  releaseStaleJobs,
} from "../job.server";
import { reconcileOnboardingWithCompletedJobs } from "../onboarding.server";
import * as ordersServer from "../orders.server";
import * as productServer from "../product.server";
import { runNextJob } from "../worker.server";

function seedRunningOnboarding(input: {
  jobId: string;
  productSyncStatus?: "running" | "completed";
  inventorySyncStatus?: "running" | "completed" | "not_started";
  ordersSyncStatus?: "running" | "completed" | "not_started";
  productSyncJobId?: string | null;
  inventorySyncJobId?: string | null;
  ordersSyncJobId?: string | null;
  currentJobId?: string;
}) {
  const harness = testHarness();

  harness.dbState.storeOnboarding.set(STORE_ID, {
    id: crypto.randomUUID(),
    storeId: STORE_ID,
    onboardingRunId: crypto.randomUUID(),
    status: "running",
    currentJobId: input.currentJobId ?? input.jobId,
    productSyncStatus: input.productSyncStatus ?? "running",
    productSyncJobId: input.productSyncJobId ?? input.jobId,
    productSyncCompletedAt: null,
    inventorySyncStatus: input.inventorySyncStatus ?? "not_started",
    inventorySyncJobId: input.inventorySyncJobId ?? null,
    inventorySyncCompletedAt: null,
    ordersSyncStatus: input.ordersSyncStatus ?? "not_started",
    ordersSyncJobId: input.ordersSyncJobId ?? null,
    ordersSyncCompletedAt: null,
    blockedReason: null,
    blockedMessage: null,
    degradedReason: null,
    progressPercent: 33,
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
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.3.8 Worker Critical Reliability Hardening", () => {
  it("1. recent heartbeat prevents stale release even when lock expired", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "heartbeat-protected",
      status: "running",
      attempts: 1,
      lockedBy: "worker-1",
      lockedAt: new Date(Date.now() - DEFAULT_LOCK_DURATION_MS),
      lockExpiresAt: new Date(Date.now() - 1_000),
      heartbeatAt: new Date(),
    });

    const released = await releaseStaleJobs();

    expect(released).toHaveLength(0);
    expect(harness.dbState.syncJobs.get(job.id)?.status).toBe("running");

    await extendJobLock({
      jobId: job.id,
      storeId: STORE_ID,
      workerId: "worker-1",
    });

    const updated = harness.dbState.syncJobs.get(job.id);
    expect(updated?.lockExpiresAt).not.toBeNull();
    expect(updated?.lockExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("2. stale release still requeues when heartbeat is older than grace window", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "heartbeat-stale",
      status: "running",
      attempts: 1,
      lockedBy: "worker-1",
      lockExpiresAt: new Date(Date.now() - 1_000),
      heartbeatAt: new Date(
        Date.now() - DEFAULT_LOCK_DURATION_MS * 2 - 1_000,
      ),
    });

    const released = await releaseStaleJobs();

    expect(released).toHaveLength(1);
    expect(released[0]?.id).toBe(job.id);
    expect(harness.dbState.syncJobs.get(job.id)?.status).toBe("queued");
  });

  it("3. completed job auto-repairs onboarding phase mismatch", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "repair-completed-job",
      status: "completed",
      attempts: 1,
      completedAt: new Date(),
    });

    seedRunningOnboarding({
      jobId: job.id,
      productSyncStatus: "running",
      productSyncJobId: job.id,
      currentJobId: job.id,
    });

    const repaired = await reconcileOnboardingWithCompletedJobs();

    expect(repaired).toBe(1);
    expect(harness.getOnboarding(STORE_ID)?.productSyncStatus).toBe("completed");
    expect(harness.getOnboarding(STORE_ID)?.inventorySyncStatus).toBe("running");
  });

  it("4. orders blocked path completes onboarding without dead letter", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "orders_historical",
      idempotencyKey: "orders-blocked",
      status: "queued",
      maxAttempts: 5,
      priority: "critical",
    });

    seedRunningOnboarding({
      jobId: job.id,
      productSyncStatus: "completed",
      productSyncJobId: null,
      inventorySyncStatus: "completed",
      inventorySyncJobId: null,
      ordersSyncStatus: "running",
      ordersSyncJobId: job.id,
      currentJobId: job.id,
    });

    vi.spyOn(ordersServer, "syncOrdersFromShopify").mockResolvedValue({
      success: false,
      blocked: true,
      blockedReason: "insufficient_scope",
      blockedMessage: "read_orders scope missing",
      orderPages: 0,
      ordersProcessed: 0,
      lineItemsProcessed: 0,
      upserted: 0,
      skipped: 0,
    });

    const result = await runNextJob("worker-orders-blocked");

    expect(result?.status).toBe("blocked");
    expect(harness.dbState.syncJobs.get(job.id)?.status).toBe("completed");
    expect(harness.getOnboarding(STORE_ID)?.ordersSyncStatus).toBe("blocked");
    expect(harness.getOnboarding(STORE_ID)?.blockedReason).toBe(
      "insufficient_scope",
    );
    expect(harness.getOnboarding(STORE_ID)?.status).toBe("completed");
  });

  it("5. ownership conflict does not crash worker cycle", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "ownership-conflict",
      status: "queued",
      maxAttempts: 3,
      priority: "critical",
    });

    seedRunningOnboarding({ jobId: job.id });

    vi.spyOn(productServer, "syncProductsFromShopify").mockImplementation(
      async () => {
        const current = harness.dbState.syncJobs.get(job.id);
        if (current) {
          current.lockedBy = null;
          current.lockExpiresAt = null;
          harness.dbState.syncJobs.set(job.id, current);
        }

        return {
          success: true,
          upserted: 1,
          skipped: 0,
          productsProcessed: 1,
          variantsProcessed: 1,
          productPages: 1,
        };
      },
    );

    await expect(runNextJob("worker-1")).resolves.toEqual(
      expect.objectContaining({
        jobId: job.id,
        status: "ownership_conflict",
        workerId: "worker-1",
      }),
    );
  });

  it("6. heartbeatJob extends lock expiry", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "heartbeat-extends-lock",
      status: "running",
      attempts: 1,
      lockedBy: "worker-1",
      lockExpiresAt: new Date(Date.now() - 1_000),
      heartbeatAt: new Date(Date.now() - DEFAULT_LOCK_DURATION_MS * 2 - 1_000),
    });

    await heartbeatJob({
      jobId: job.id,
      storeId: STORE_ID,
      workerId: "worker-1",
    });

    const updated = harness.dbState.syncJobs.get(job.id);
    expect(updated?.lockExpiresAt).not.toBeNull();
    expect(updated?.lockExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });
});
