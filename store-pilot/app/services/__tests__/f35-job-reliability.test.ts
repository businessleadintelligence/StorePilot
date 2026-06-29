import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  JobWorkerOwnershipError,
  completeJob,
  failJob,
  findExpiredRunningJobs,
  heartbeatJob,
  releaseStaleJobs,
} from "../job.server";
import {
  OnboardingPhaseStartError,
  advanceOnboarding,
  findStuckOnboarding,
  getOrCreateStoreOnboarding,
  markPhaseFailed,
  markPhaseStarted,
  resumeOnboarding,
  retryOnboardingPhase,
} from "../onboarding.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.3.5 Job Reliability Hardening", () => {
  it("1. releaseStaleJobs requeues expired running jobs", async () => {
    const harness = testHarness();
    const staleJob = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "stale-job",
      status: "running",
      attempts: 1,
      lockedBy: "worker-1",
      lockedAt: new Date(Date.now() - 60_000),
      lockExpiresAt: new Date(Date.now() - 1_000),
      heartbeatAt: new Date(Date.now() - 11 * 60_000),
    });

    const released = await releaseStaleJobs();

    expect(released).toHaveLength(1);
    expect(released[0]?.id).toBe(staleJob.id);
    expect(released[0]?.status).toBe("queued");
    expect(released[0]?.lockedBy).toBeNull();
    expect(released[0]?.lockExpiresAt).toBeNull();
    expect(
      harness.getJobEvents(staleJob.id).some((event) => event.eventType === "retried"),
    ).toBe(true);
  });

  it("2. worker ownership mismatch throws on heartbeat", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "ownership-job",
      status: "running",
      attempts: 1,
      lockedBy: "worker-a",
    });

    await expect(
      heartbeatJob({
        jobId: job.id,
        storeId: STORE_ID,
        workerId: "worker-b",
      }),
    ).rejects.toBeInstanceOf(JobWorkerOwnershipError);
  });

  it("3. worker ownership mismatch throws on completeJob", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "ownership-complete",
      status: "running",
      attempts: 1,
      lockedBy: "worker-a",
    });

    await expect(
      completeJob({
        jobId: job.id,
        storeId: STORE_ID,
        workerId: "worker-b",
      }),
    ).rejects.toBeInstanceOf(JobWorkerOwnershipError);
  });

  it("4. worker ownership mismatch throws on failJob", async () => {
    const harness = testHarness();
    const job = harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "ownership-fail",
      status: "running",
      attempts: 1,
      maxAttempts: 3,
      lockedBy: "worker-a",
    });

    await expect(
      failJob({
        jobId: job.id,
        storeId: STORE_ID,
        workerId: "worker-b",
        errorCode: "test",
        errorMessage: "test",
      }),
    ).rejects.toBeInstanceOf(JobWorkerOwnershipError);
  });

  it("5. advanceOnboarding links job and onboarding atomically", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);

    const result = await advanceOnboarding({ storeId: STORE_ID });
    const harness = testHarness();
    const onboarding = harness.getOnboarding(STORE_ID);

    expect(result.action).toBe("enqueued");
    expect(onboarding?.currentJobId).toBe(result.jobId);
    expect(onboarding?.productSyncJobId).toBe(result.jobId);
    expect(onboarding?.productSyncStatus).toBe("running");
    expect(harness.dbState.syncJobs.size).toBe(1);
  });

  it("6. retryOnboardingPhase creates a fresh run-scoped job", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    await advanceOnboarding({ storeId: STORE_ID });
    await markPhaseFailed(STORE_ID, "PRODUCTS", "shopify_timeout");

    const harness = testHarness();
    const beforeRunId = harness.getOnboarding(STORE_ID)?.onboardingRunId;

    const result = await retryOnboardingPhase(STORE_ID, "PRODUCTS");
    const onboarding = harness.getOnboarding(STORE_ID);

    expect(result.action).toBe("retried");
    expect(onboarding?.onboardingRunId).not.toBe(beforeRunId);
    expect(onboarding?.productSyncStatus).toBe("running");
    expect(onboarding?.currentJobId).toBe(result.jobId);
    expect(harness.dbState.syncJobs.size).toBe(2);
    expect(
      [...harness.dbState.syncJobs.values()].some(
        (job) =>
          job.idempotencyKey ===
          `onboarding:${STORE_ID}:products:${onboarding?.onboardingRunId}`,
      ),
    ).toBe(true);
  });

  it("7. resumeOnboarding retries from failed phase", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    await advanceOnboarding({ storeId: STORE_ID });
    await markPhaseFailed(STORE_ID, "PRODUCTS", "shopify_timeout");

    const result = await resumeOnboarding(STORE_ID);
    const harness = testHarness();

    expect(result.action).toBe("resumed");
    expect(harness.getOnboarding(STORE_ID)?.status).toBe("running");
    expect(harness.getOnboarding(STORE_ID)?.productSyncStatus).toBe("running");
    expect(harness.dbState.syncJobs.size).toBe(2);
  });

  it("8. markPhaseStarted throws when currentJobId is missing", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);

    await expect(markPhaseStarted(STORE_ID, "PRODUCTS")).rejects.toBeInstanceOf(
      OnboardingPhaseStartError,
    );
  });

  it("9. findExpiredRunningJobs returns only expired locks", async () => {
    const harness = testHarness();
    harness.seedSyncJob({
      jobType: "bootstrap_products",
      idempotencyKey: "expired-job",
      status: "running",
      lockExpiresAt: new Date(Date.now() - 1_000),
    });
    harness.seedSyncJob({
      jobType: "bootstrap_inventory",
      idempotencyKey: "active-job",
      status: "running",
      lockExpiresAt: new Date(Date.now() + 60_000),
    });

    const expired = await findExpiredRunningJobs();

    expect(expired).toHaveLength(1);
    expect(expired[0]?.idempotencyKey).toBe("expired-job");
  });

  it("10. findStuckOnboarding detects stale current job references", async () => {
    const harness = testHarness();
    await getOrCreateStoreOnboarding(STORE_ID);
    await advanceOnboarding({ storeId: STORE_ID });

    const onboarding = harness.getOnboarding(STORE_ID)!;
    const completedJob = harness.dbState.syncJobs.get(onboarding.currentJobId!)!;
    completedJob.status = "completed";
    harness.dbState.syncJobs.set(completedJob.id, completedJob);

    const stuck = await findStuckOnboarding({ staleMinutes: 0 });

    expect(stuck.some((row) => row.storeId === STORE_ID)).toBe(true);
    expect(stuck[0]?.currentJobStatus).toBe("completed");
  });
});
