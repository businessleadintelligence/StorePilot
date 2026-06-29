import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  getFounderOperationsSnapshot,
  getJobsHealthIndicator,
  getOnboardingHealthIndicator,
} from "../founder-ops.server";

function seedOnboardingRow(
  storeId: string,
  overrides: {
    status?: "not_started" | "queued" | "running" | "completed" | "failed";
    ordersSyncStatus?:
      | "not_started"
      | "queued"
      | "running"
      | "completed"
      | "failed"
      | "blocked"
      | "skipped";
    blockedReason?: string | null;
    currentJobId?: string | null;
    updatedAt?: Date;
  } = {},
) {
  const harness = testHarness();
  harness.dbState.storeOnboarding.set(storeId, {
    id: `onboarding-${storeId}`,
    storeId,
    status: overrides.status ?? "not_started",
    onboardingRunId: "run-founder-ops",
    currentJobId: overrides.currentJobId ?? null,
    productSyncStatus: "not_started",
    productSyncJobId: null,
    productSyncCompletedAt: null,
    inventorySyncStatus: "not_started",
    inventorySyncJobId: null,
    inventorySyncCompletedAt: null,
    ordersSyncStatus: overrides.ordersSyncStatus ?? "not_started",
    ordersSyncJobId: null,
    ordersSyncCompletedAt: null,
    blockedReason: overrides.blockedReason ?? null,
    blockedMessage: null,
    degradedReason: null,
    progressPercent: 0,
    progressLabel: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    attempts: 0,
    maxAttempts: 5,
    startedAt: null,
    coreCompletedAt: null,
    completedAt: null,
    fullCompletedAt: null,
    failedAt: null,
    createdAt: new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  });
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
});

describe("F.5.0 Founder Operations Snapshot", () => {
  it("1. returns empty system counts", async () => {
    const snapshot = await getFounderOperationsSnapshot();

    expect(snapshot).toMatchObject({
      stores: {
        totalStores: 1,
        activeStores: 1,
        inactiveStores: 0,
      },
      onboarding: {
        completed: 0,
        running: 0,
        failed: 0,
        blocked: 0,
        notStarted: 0,
      },
      jobs: {
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        deadLetter: 0,
      },
      webhooks: {
        processed: 0,
        failed: 0,
        pending: 0,
      },
      workers: {
        staleJobs: 0,
        stuckOnboarding: 0,
        expiredLocks: 0,
      },
    });
    expect(snapshot.startupReadiness).toBeDefined();
    expect(Array.isArray(snapshot.startupReadiness.checks)).toBe(true);
  });

  it("2. counts active and inactive stores", async () => {
    const harness = testHarness();
    harness.dbState.stores.push({
      id: "store-inactive-001",
      shopifyDomain: "inactive.myshopify.com",
      active: false,
      currency: "USD",
      accessToken: "secret-token-should-not-leak",
      ga4RefreshToken: "secret-refresh-should-not-leak",
      ga4PropertyId: "properties/999",
      lastAuthenticatedAt: null,
      firstTrialStartedAt: null,
      lastProductsSyncAt: null,
      lastInventorySyncAt: null,
      historicalOrdersImportDone: false,
      lastOrdersSyncAt: null,
      ordersSyncCursor: null,
    });

    const snapshot = await getFounderOperationsSnapshot();

    expect(snapshot.stores).toEqual({
      totalStores: 2,
      activeStores: 1,
      inactiveStores: 1,
    });
  });

  it("3. counts onboarding states", async () => {
    seedOnboardingRow(STORE_ID, { status: "completed" });
    seedOnboardingRow("store-002", { status: "running" });
    seedOnboardingRow("store-003", {
      status: "running",
      ordersSyncStatus: "blocked",
      blockedReason: "access_denied",
    });
    seedOnboardingRow("store-004", { status: "failed" });
    seedOnboardingRow("store-005", { status: "not_started" });

    const snapshot = await getFounderOperationsSnapshot();

    expect(snapshot.onboarding).toEqual({
      completed: 1,
      running: 2,
      failed: 1,
      blocked: 1,
      notStarted: 1,
    });
  });

  it("4. counts sync jobs by status", async () => {
    const harness = testHarness();

    harness.seedSyncJob({
      idempotencyKey: "job-queued",
      jobType: "bootstrap_products",
      status: "queued",
    });
    harness.seedSyncJob({
      idempotencyKey: "job-running",
      jobType: "bootstrap_inventory",
      status: "running",
    });
    harness.seedSyncJob({
      idempotencyKey: "job-completed",
      jobType: "orders_historical",
      status: "completed",
    });
    harness.seedSyncJob({
      idempotencyKey: "job-failed",
      jobType: "orders_incremental",
      status: "failed",
    });
    harness.seedSyncJob({
      idempotencyKey: "job-dead",
      jobType: "orders_incremental",
      status: "dead_letter",
    });

    const snapshot = await getFounderOperationsSnapshot();

    expect(snapshot.jobs).toEqual({
      queued: 1,
      running: 1,
      completed: 1,
      failed: 1,
      deadLetter: 1,
    });
  });

  it("5. counts webhook events", async () => {
    await prisma.webhookEvent.create({
      data: {
        storeId: STORE_ID,
        shopifyWebhookId: "wh-processed-1",
        shop: "storepilot-test.myshopify.com",
        topic: "products/create",
        processedSuccessfully: true,
      },
    });
    await prisma.webhookEvent.create({
      data: {
        storeId: STORE_ID,
        shopifyWebhookId: "wh-pending-1",
        shop: "storepilot-test.myshopify.com",
        topic: "orders/create",
        processedSuccessfully: false,
      },
    });

    const snapshot = await getFounderOperationsSnapshot();

    expect(snapshot.webhooks).toEqual({
      processed: 1,
      pending: 1,
      failed: 1,
    });
  });

  it("6. reports worker diagnostics from expired locks and stuck onboarding", async () => {
    const harness = testHarness();
    const expiredJob = harness.seedSyncJob({
      idempotencyKey: "job-expired-lock",
      jobType: "bootstrap_products",
      status: "running",
      lockExpiresAt: new Date(Date.now() - 60_000),
    });

    seedOnboardingRow(STORE_ID, {
      status: "running",
      currentJobId: expiredJob.id,
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const snapshot = await getFounderOperationsSnapshot();

    expect(snapshot.workers.staleJobs).toBe(1);
    expect(snapshot.workers.expiredLocks).toBe(1);
    expect(snapshot.workers.stuckOnboarding).toBeGreaterThan(0);
  });

  it("7. exposes counts only without secrets or payloads", async () => {
    const harness = testHarness();
    harness.dbState.stores[0]!.accessToken = "super-secret-token";
    harness.seedSyncJob({
      idempotencyKey: "job-payload-check",
      jobType: "bootstrap_products",
      status: "failed",
      payload: { secret: "job-payload-should-not-leak" },
    });

    const snapshot = await getFounderOperationsSnapshot();
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("job-payload-should-not-leak");
    expect(serialized).not.toContain("ga4RefreshToken");
    expect(Object.values(snapshot.stores).every((value) => typeof value === "number")).toBe(
      true,
    );
  });

  it("8. maps health indicators for jobs and onboarding", () => {
    expect(getJobsHealthIndicator(0)).toBe("green");
    expect(getJobsHealthIndicator(3)).toBe("yellow");
    expect(getJobsHealthIndicator(6)).toBe("red");
    expect(getOnboardingHealthIndicator(0)).toBe("green");
    expect(getOnboardingHealthIndicator(1)).toBe("red");
  });
});
