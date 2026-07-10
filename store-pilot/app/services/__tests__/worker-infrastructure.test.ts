import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeHeartbeatStaleCutoff,
  computeLockExpiresAt,
  computeRetryAvailableAt,
  isJobEligibleForStaleRelease,
  resolveLockDurationMs,
} from "../job.server";
import {
  getWorkerRuntimeMetrics,
  recordWorkerCycleCompleted,
  recordWorkerJobFailed,
  resetWorkerRuntimeMetricsForTests,
} from "../worker-metrics.server";
import {
  requestWorkerShutdown,
  resetWorkerRuntimeForTests,
} from "../worker-runtime.server";

describe("worker infrastructure", () => {
  beforeEach(() => {
    resetWorkerRuntimeMetricsForTests();
    resetWorkerRuntimeForTests();
    vi.restoreAllMocks();
  });

  it("computes exponential retry delay with jitter cap", () => {
    const first = computeRetryAvailableAt(1);
    const second = computeRetryAvailableAt(2);
    const third = computeRetryAvailableAt(3);

    expect(second.getTime() - Date.now()).toBeGreaterThan(
      first.getTime() - Date.now(),
    );
    expect(third.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000 + 5_000);
  });

  it("treats claimed jobs as eligible for stale release when lock expired", () => {
    const lockDurationMs = resolveLockDurationMs();
    const now = new Date();
    const expiredLock = computeLockExpiresAt(
      new Date(now.getTime() - lockDurationMs - 1_000),
      lockDurationMs,
    );

    expect(
      isJobEligibleForStaleRelease(
        {
          status: "claimed",
          lockExpiresAt: expiredLock,
          heartbeatAt: computeHeartbeatStaleCutoff(lockDurationMs, now),
        },
        lockDurationMs,
        now,
      ),
    ).toBe(true);
  });

  it("records worker runtime throughput counters", () => {
    recordWorkerCycleCompleted(2);
    recordWorkerJobFailed();

    const metrics = getWorkerRuntimeMetrics();
    expect(metrics.cyclesCompleted).toBe(1);
    expect(metrics.jobsProcessed).toBe(2);
    expect(metrics.jobsFailed).toBe(1);
    expect(metrics.lastCycleAt).not.toBeNull();
  });

  it("supports graceful shutdown request without throwing", () => {
    expect(() => requestWorkerShutdown()).not.toThrow();
  });
});
