import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import * as inventoryServer from "../inventory.server";
import * as ordersServer from "../orders.server";
import * as productServer from "../product.server";
import { runNextJob, runWorkerCycle } from "../worker.server";

function seedQueuedBootstrapJob(input: {
  jobType: "bootstrap_products" | "bootstrap_inventory" | "orders_historical";
  idempotencyKey: string;
  maxAttempts?: number;
  attempts?: number;
}) {
  const harness = testHarness();

  return harness.seedSyncJob({
    jobType: input.jobType,
    idempotencyKey: input.idempotencyKey,
    status: "queued",
    maxAttempts: input.maxAttempts ?? 3,
    attempts: input.attempts ?? 0,
    priority: "critical",
  });
}

beforeEach(() => {
  process.env.SCOPES = "read_products,read_inventory,write_products,read_orders";
  process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET ?? "test-shopify-api-secret";
  const harness = testHarness();
  harness.resetDbState();
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.3.7 Worker Execution Engine", () => {
  it("1. executes bootstrap_products successfully", async () => {
    const harness = testHarness();
    const job = seedQueuedBootstrapJob({
      jobType: "bootstrap_products",
      idempotencyKey: "worker-products-success",
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

    vi.spyOn(productServer, "syncProductsFromShopify").mockResolvedValue({
      success: true,
      upserted: 2,
      skipped: 0,
      productsProcessed: 1,
      variantsProcessed: 2,
      productPages: 1,
    });

    const result = await runNextJob("worker-1");

    expect(result?.status).toBe("completed");
    expect(result?.jobType).toBe("bootstrap_products");
    expect(harness.dbState.syncJobs.get(job.id)?.status).toBe("completed");
    expect(harness.getOnboarding(STORE_ID)?.productSyncStatus).toBe("completed");
  });

  it("2. executes bootstrap_inventory successfully", async () => {
    const harness = testHarness();
    const job = seedQueuedBootstrapJob({
      jobType: "bootstrap_inventory",
      idempotencyKey: "worker-inventory-success",
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
      progressPercent: 66,
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

    vi.spyOn(inventoryServer, "syncInventoryFromShopify").mockResolvedValue({
      success: true,
      inventoryItemsProcessed: 1,
      variantsUpdated: 1,
      skipped: 0,
    });

    const result = await runNextJob("worker-1");

    expect(result?.status).toBe("completed");
    expect(result?.jobType).toBe("bootstrap_inventory");
    expect(harness.getOnboarding(STORE_ID)?.inventorySyncStatus).toBe("completed");
  });

  it("3. executes orders_historical successfully", async () => {
    const harness = testHarness();
    const job = seedQueuedBootstrapJob({
      jobType: "orders_historical",
      idempotencyKey: "worker-orders-success",
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
      success: true,
      orderPages: 1,
      ordersProcessed: 1,
      lineItemsProcessed: 1,
      upserted: 1,
      skipped: 0,
    });

    const result = await runNextJob("worker-1");

    expect(result?.status).toBe("completed");
    expect(result?.jobType).toBe("orders_historical");
    expect(harness.getOnboarding(STORE_ID)?.ordersSyncStatus).toBe("completed");
  });

  it("4. schedules retry when sync fails", async () => {
    const job = seedQueuedBootstrapJob({
      jobType: "bootstrap_products",
      idempotencyKey: "worker-products-retry",
      maxAttempts: 3,
    });

    vi.spyOn(productServer, "syncProductsFromShopify").mockResolvedValue({
      success: false,
      upserted: 0,
      skipped: 0,
      productsProcessed: 0,
      variantsProcessed: 0,
      productPages: 0,
    });

    const result = await runNextJob("worker-1");
    const harness = testHarness();
    const updatedJob = harness.dbState.syncJobs.get(job.id);

    expect(result?.status).toBe("failed");
    expect(updatedJob?.status).toBe("queued");
    expect(updatedJob?.attempts).toBe(1);
  });

  it("5. dead-letters job and marks onboarding failed at max attempts", async () => {
    const harness = testHarness();
    const job = seedQueuedBootstrapJob({
      jobType: "bootstrap_products",
      idempotencyKey: "worker-products-dead-letter",
      maxAttempts: 1,
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

    vi.spyOn(productServer, "syncProductsFromShopify").mockResolvedValue({
      success: false,
      upserted: 0,
      skipped: 0,
      productsProcessed: 0,
      variantsProcessed: 0,
      productPages: 0,
    });

    const result = await runNextJob("worker-1");

    expect(result?.status).toBe("dead_letter");
    expect(harness.dbState.syncJobs.get(job.id)?.status).toBe("dead_letter");
    expect(harness.getOnboarding(STORE_ID)?.status).toBe("failed");
    expect(harness.getOnboarding(STORE_ID)?.productSyncStatus).toBe("failed");
    expect(harness.getOnboarding(STORE_ID)?.productSyncJobId).toBeNull();
  });

  it("6. completes founder maintenance jobs", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "founder_maintenance",
      idempotencyKey: "worker-founder-maintenance",
      status: "queued",
      maxAttempts: 1,
      priority: "normal",
    });

    const result = await runNextJob("worker-1");

    expect(result?.status).toBe("completed");
    expect(result?.jobType).toBe("founder_maintenance");
    expect(harness.dbState.syncJobs.get(job.id)?.status).toBe("completed");
  });

  it("7. returns null when queue is empty", async () => {
    const result = await runNextJob("worker-1");
    expect(result).toBeNull();
  });

  it("8. runWorkerCycle wraps a single job execution", async () => {
    seedQueuedBootstrapJob({
      jobType: "bootstrap_products",
      idempotencyKey: "worker-cycle",
    });

    vi.spyOn(productServer, "syncProductsFromShopify").mockResolvedValue({
      success: true,
      upserted: 1,
      skipped: 0,
      productsProcessed: 1,
      variantsProcessed: 1,
      productPages: 1,
    });

    const cycle = await runWorkerCycle("worker-cycle");

    expect(cycle.workerId).toBe("worker-cycle");
    expect(cycle.processed?.status).toBe("completed");
  });
});
