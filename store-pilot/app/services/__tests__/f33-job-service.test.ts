import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  cancelJob,
  claimNextJob,
  completeJob,
  enqueueJob,
  failJob,
  heartbeatJob,
} from "../job.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.3.3 Job Service Foundation", () => {
  it("1. enqueueJob creates a queued job and created event", async () => {
    const job = await enqueueJob({
      storeId: STORE_ID,
      jobType: "bootstrap_products",
      idempotencyKey: "job-bootstrap-products-001",
      maxAttempts: 3,
    });

    const harness = testHarness();
    const events = harness.getJobEvents(job.id);

    expect(job.status).toBe("queued");
    expect(job.attempts).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("progress");
    expect(events[0]?.metadataJson).toEqual({ eventKind: "created" });
  });

  it("2. enqueueJob returns existing job for duplicate idempotencyKey", async () => {
    const first = await enqueueJob({
      storeId: STORE_ID,
      jobType: "bootstrap_products",
      idempotencyKey: "job-bootstrap-products-dup",
      maxAttempts: 3,
    });

    const second = await enqueueJob({
      storeId: STORE_ID,
      jobType: "bootstrap_products",
      idempotencyKey: "job-bootstrap-products-dup",
      maxAttempts: 3,
    });

    const harness = testHarness();
    expect(second.id).toBe(first.id);
    expect(harness.dbState.syncJobs.size).toBe(1);
    expect(harness.getJobEvents(first.id)).toHaveLength(1);
  });

  it("3. claimNextJob claims highest priority job FIFO within priority", async () => {
    const harness = testHarness();
    harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "job-low-old",
      priority: "low",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    harness.seedSyncJob({
      jobType: "bootstrap_inventory",
      idempotencyKey: "job-normal-newer",
      priority: "normal",
      createdAt: new Date("2026-01-02T00:00:00Z"),
    });
    harness.seedSyncJob({
      jobType: "orders_historical",
      idempotencyKey: "job-critical-newest",
      priority: "critical",
      createdAt: new Date("2026-01-03T00:00:00Z"),
    });

    const claim = await claimNextJob({ workerId: "worker-1" });

    expect(claim?.job.jobType).toBe("orders_historical");
    expect(claim?.job.status).toBe("running");
    expect(claim?.job.attempts).toBe(1);
    expect(claim?.workerId).toBe("worker-1");
    expect(harness.getJobEvents(claim!.job.id).some((e) => e.eventType === "claimed")).toBe(
      true,
    );
  });

  it("4. claimNextJob returns null when no queued jobs are available", async () => {
    const claim = await claimNextJob({ workerId: "worker-1" });
    expect(claim).toBeNull();
  });

  it("5. heartbeatJob updates heartbeatAt and records heartbeat event", async () => {
    const harness = testHarness();
    const seeded = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "job-heartbeat",
      status: "running",
      attempts: 1,
      lockedBy: "worker-1",
    });

    const job = await heartbeatJob({
      jobId: seeded.id,
      storeId: STORE_ID,
      workerId: "worker-1",
      progressPercent: 40,
      progressLabel: "Syncing products",
    });

    const events = harness.getJobEvents(job.id);

    expect(job.heartbeatAt).toBeInstanceOf(Date);
    expect(job.progressJson).toEqual({
      percent: 40,
      label: "Syncing products",
    });
    expect(
      events.some(
        (event) =>
          (event.metadataJson as { eventKind?: string } | null)?.eventKind ===
          "heartbeat",
      ),
    ).toBe(true);
  });

  it("6. completeJob marks job completed with 100 percent progress", async () => {
    const harness = testHarness();
    const seeded = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "job-complete",
      status: "running",
      attempts: 1,
      lockedBy: "worker-1",
    });

    const job = await completeJob({
      jobId: seeded.id,
      storeId: STORE_ID,
      workerId: "worker-1",
      durationMs: 1200,
    });

    const events = harness.getJobEvents(job.id);

    expect(job.status).toBe("completed");
    expect(job.completedAt).toBeInstanceOf(Date);
    expect(job.progressJson).toEqual({ percent: 100 });
    expect(job.durationMs).toBe(1200);
    expect(events.some((event) => event.eventType === "completed")).toBe(true);
  });

  it("7. failJob schedules retry with failed and retried events", async () => {
    const harness = testHarness();
    const seeded = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "job-retry",
      status: "running",
      attempts: 1,
      maxAttempts: 3,
      lockedBy: "worker-1",
    });

    const job = await failJob({
      jobId: seeded.id,
      storeId: STORE_ID,
      workerId: "worker-1",
      errorCode: "shopify_timeout",
      errorMessage: "Shopify timed out",
      retryDelayMs: 1_000,
    });

    const events = harness.getJobEvents(job.id);
    const eventTypes = events.map((event) => event.eventType);

    expect(job.status).toBe("queued");
    expect(job.attempts).toBe(1);
    expect(job.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(eventTypes).toContain("failed");
    expect(eventTypes).toContain("retried");
  });

  it("8. failJob dead-letters job when attempts reach maxAttempts", async () => {
    const harness = testHarness();
    const seeded = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "job-dead-letter",
      status: "running",
      attempts: 3,
      maxAttempts: 3,
      lockedBy: "worker-1",
    });

    const job = await failJob({
      jobId: seeded.id,
      storeId: STORE_ID,
      workerId: "worker-1",
      errorCode: "shopify_timeout",
      errorMessage: "Shopify timed out",
    });

    const events = harness.getJobEvents(job.id);
    const eventTypes = events.map((event) => event.eventType);

    expect(job.status).toBe("dead_letter");
    expect(job.deadLetterAt).toBeInstanceOf(Date);
    expect(eventTypes).toContain("failed");
    expect(eventTypes).toContain("dead_lettered");
  });

  it("9. cancelJob marks job cancelled and records cancelled event", async () => {
    const harness = testHarness();
    const seeded = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "job-cancel",
      status: "queued",
    });

    const job = await cancelJob({
      jobId: seeded.id,
      storeId: STORE_ID,
      workerId: "worker-1",
      reason: "merchant_uninstalled",
    });

    const events = harness.getJobEvents(job.id);

    expect(job.status).toBe("cancelled");
    expect(job.cancelledAt).toBeInstanceOf(Date);
    expect(events.some((event) => event.eventType === "cancelled")).toBe(true);
  });
});
