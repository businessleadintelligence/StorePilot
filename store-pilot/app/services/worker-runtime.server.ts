import { randomUUID } from "node:crypto";

import prisma from "../db.server";
import { recoverOrphanJobs } from "./job.server";
import {
  getInFlightJobId,
  resetInFlightJobForTests,
  trackInFlightJob,
} from "./worker-in-flight.server";
import {
  getWorkerRuntimeMetrics,
  recordWorkerCycleCompleted,
  recordWorkerJobFailed,
} from "./worker-metrics.server";
import {
  getActiveWorkerIds,
  heartbeatWorkerInstance,
  markWorkerDraining,
  markWorkerStopped,
  registerWorkerInstance,
  resolveWorkerHeartbeatIntervalMsFromEnv,
  resolveWorkerStaleThresholdMs,
} from "./worker-registry.server";
import {
  runWorkerBatch,
  type RunWorkerCycleResult,
} from "./worker.server";

const LOG_PREFIX = "[worker-runtime]";

export type WorkerRuntimeState = "starting" | "running" | "draining" | "stopped";

export type WorkerRuntimeOptions = {
  workerId?: string;
  pollIntervalMs?: number;
  batchSize?: number;
  heartbeatIntervalMs?: number;
  env?: NodeJS.ProcessEnv;
};

export type WorkerRuntimeSnapshot = {
  workerId: string;
  state: WorkerRuntimeState;
  pollIntervalMs: number;
  batchSize: number;
  inFlightJobId: string | null;
  metrics: ReturnType<typeof getWorkerRuntimeMetrics>;
};

let runtimeState: WorkerRuntimeState = "stopped";
let runtimeWorkerId: string | null = null;
let shutdownRequested = false;
let heartbeatTimer: NodeJS.Timeout | null = null;

function resolvePollIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.WORKER_POLL_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw < 500) {
    return 2_000;
  }
  return Math.min(30_000, Math.floor(raw));
}

function resolveBatchSize(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.WORKER_BATCH_SIZE ?? env.CRON_JOB_BATCH_SIZE ?? 3);
  if (!Number.isFinite(raw) || raw < 1) {
    return 1;
  }
  return Math.min(10, Math.floor(raw));
}

function logRuntime(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown>,
): void {
  const payload = { message, ...context };
  if (level === "error") {
    console.error(LOG_PREFIX, payload);
    return;
  }
  if (level === "warn") {
    console.warn(LOG_PREFIX, payload);
    return;
  }
  console.info(LOG_PREFIX, payload);
}

export function getWorkerRuntimeSnapshot(): WorkerRuntimeSnapshot | null {
  if (!runtimeWorkerId) {
    return null;
  }

  return {
    workerId: runtimeWorkerId,
    state: runtimeState,
    pollIntervalMs: resolvePollIntervalMs(),
    batchSize: resolveBatchSize(),
    inFlightJobId: getInFlightJobId(),
    metrics: getWorkerRuntimeMetrics(),
  };
}

export function isWorkerShutdownRequested(): boolean {
  return shutdownRequested;
}

export function requestWorkerShutdown(): void {
  shutdownRequested = true;
  if (runtimeState === "running") {
    runtimeState = "draining";
  }
}

async function emitWorkerHeartbeat(workerId: string): Promise<void> {
  const metrics = getWorkerRuntimeMetrics();
  await heartbeatWorkerInstance({
    workerId,
    currentJobId: getInFlightJobId(),
    jobsProcessed: metrics.jobsProcessed,
    jobsFailed: metrics.jobsFailed,
  });
}

function startWorkerHeartbeatLoop(
  workerId: string,
  intervalMs: number,
): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  heartbeatTimer = setInterval(() => {
    void emitWorkerHeartbeat(workerId).catch((error) => {
      logRuntime("warn", "Worker heartbeat failed", {
        workerId,
        operation: "worker_heartbeat_failed",
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    });
  }, intervalMs);

  heartbeatTimer.unref?.();
}

function stopWorkerHeartbeatLoop(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function runRecoveryCycle(env: NodeJS.ProcessEnv): Promise<void> {
  const activeWorkerIds = await getActiveWorkerIds(env);
  const recovered = await recoverOrphanJobs({
    activeWorkerIds,
    lockDurationMs: undefined,
  });

  if (recovered.length > 0) {
    logRuntime("warn", "Recovered orphan jobs", {
      workerId: runtimeWorkerId ?? "unknown",
      operation: "orphan_recovery",
      count: recovered.length,
    });
  }
}

async function executeBatch(
  workerId: string,
  batchSize: number,
): Promise<RunWorkerCycleResult> {
  return runWorkerBatch(workerId, batchSize);
}

export async function runContinuousWorker(
  options: WorkerRuntimeOptions = {},
): Promise<void> {
  const env = options.env ?? process.env;
  const workerId = options.workerId ?? `worker-${randomUUID()}`;
  const pollIntervalMs = options.pollIntervalMs ?? resolvePollIntervalMs(env);
  const batchSize = options.batchSize ?? resolveBatchSize(env);
  const heartbeatIntervalMs =
    options.heartbeatIntervalMs ??
    resolveWorkerHeartbeatIntervalMsFromEnv(env);

  runtimeWorkerId = workerId;
  runtimeState = "starting";
  shutdownRequested = false;

  await registerWorkerInstance({ workerId });
  startWorkerHeartbeatLoop(workerId, heartbeatIntervalMs);
  runtimeState = "running";

  logRuntime("info", "Continuous worker started", {
    workerId,
    operation: "worker_runtime_started",
    pollIntervalMs,
    batchSize,
    heartbeatIntervalMs,
    staleThresholdMs: resolveWorkerStaleThresholdMs(env),
  });

  const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of shutdownSignals) {
    process.once(signal, () => {
      logRuntime("info", "Worker shutdown signal received", {
        workerId,
        operation: "worker_shutdown_signal",
        signal,
      });
      requestWorkerShutdown();
    });
  }

  try {
    while (!shutdownRequested || getInFlightJobId() !== null) {
      if (shutdownRequested && getInFlightJobId() === null) {
        break;
      }

      if (shutdownRequested) {
        runtimeState = "draining";
        await markWorkerDraining(workerId);
      }

      await runRecoveryCycle(env);

      if (shutdownRequested && getInFlightJobId() === null) {
        break;
      }

      const result = await executeBatch(workerId, batchSize);
      recordWorkerCycleCompleted(result.processedCount);

      for (const processed of result.processedJobs) {
        if (
          processed.status === "failed" ||
          processed.status === "dead_letter"
        ) {
          recordWorkerJobFailed();
        }
      }

      if (result.processedCount === 0) {
        if (shutdownRequested) {
          break;
        }
        await sleep(pollIntervalMs);
      }
    }
  } finally {
    stopWorkerHeartbeatLoop();
    runtimeState = "stopped";
    await markWorkerStopped(workerId);
    runtimeWorkerId = null;
    shutdownRequested = false;
    trackInFlightJob(null);

    logRuntime("info", "Continuous worker stopped", {
      workerId,
      operation: "worker_runtime_stopped",
    });

    await prisma.$disconnect();
  }
}

export { trackInFlightJob } from "./worker-in-flight.server";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function resetWorkerRuntimeForTests(): void {
  runtimeState = "stopped";
  runtimeWorkerId = null;
  resetInFlightJobForTests();
  shutdownRequested = false;
  stopWorkerHeartbeatLoop();
}
