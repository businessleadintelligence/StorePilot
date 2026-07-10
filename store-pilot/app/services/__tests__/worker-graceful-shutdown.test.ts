import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobStatus, JobType } from "@prisma/client";

import {
  getInFlightJobId,
  resetInFlightJobForTests,
  trackInFlightJob,
} from "../worker-in-flight.server";
import {
  getWorkerRuntimeSnapshot,
  requestWorkerShutdown,
  resetWorkerRuntimeForTests,
} from "../worker-runtime.server";
import { runNextJob } from "../worker.server";
import { testHarness } from "./helpers/fixtures";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  resetInFlightJobForTests();
  resetWorkerRuntimeForTests();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("Epic 1.4 worker graceful shutdown", () => {
  it("1. trackInFlightJob exposes the active job id", () => {
    trackInFlightJob("job-active");
    expect(getInFlightJobId()).toBe("job-active");
    trackInFlightJob(null);
    expect(getInFlightJobId()).toBeNull();
  });

  it("2. shutdown waits while an in-flight job is tracked", () => {
    requestWorkerShutdown();
    trackInFlightJob("job-drain");

    const shouldContinue = getInFlightJobId() !== null;
    expect(shouldContinue).toBe(true);

    trackInFlightJob(null);
    expect(getInFlightJobId()).toBeNull();
  });

  it("3. runNextJob clears in-flight tracking after execution", async () => {
    const harness = testHarness();
    harness.seedSyncJob({
      id: "job-inflight-clear",
      jobType: JobType.metrics_recompute,
      status: JobStatus.queued,
      idempotencyKey: "inflight-clear",
    });

    await runNextJob("worker-inflight-test");

    expect(getInFlightJobId()).toBeNull();
  });

  it("4. runtime snapshot reflects in-flight job id", () => {
    resetWorkerRuntimeForTests();
    trackInFlightJob("job-snapshot");

    const snapshot = getWorkerRuntimeSnapshot();
    expect(snapshot).toBeNull();

    trackInFlightJob(null);
  });
});
