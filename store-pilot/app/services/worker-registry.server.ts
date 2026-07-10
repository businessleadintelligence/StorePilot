import {
  WorkerInstanceStatus,
  Prisma,
  type WorkerInstance,
} from "@prisma/client";
import os from "node:os";

import prisma from "../db.server";

const LOG_PREFIX = "[worker-registry]";

export const DEFAULT_WORKER_HEARTBEAT_INTERVAL_MS = 15_000;
export const DEFAULT_WORKER_STALE_THRESHOLD_MS = 90_000;

export type RegisterWorkerInput = {
  workerId: string;
  version?: string;
  metadata?: Record<string, unknown>;
};

export type WorkerRegistrySnapshot = {
  activeWorkers: number;
  drainingWorkers: number;
  staleWorkers: number;
  workers: WorkerInstanceSummary[];
};

export type WorkerInstanceSummary = {
  id: string;
  hostname: string | null;
  pid: number | null;
  status: WorkerInstanceStatus;
  startedAt: string;
  lastHeartbeatAt: string;
  uptimeMs: number;
  jobsProcessed: number;
  jobsFailed: number;
  currentJobId: string | null;
  version: string | null;
  isStale: boolean;
};

function resolveWorkerHeartbeatIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.WORKER_HEARTBEAT_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw < 5_000) {
    return DEFAULT_WORKER_HEARTBEAT_INTERVAL_MS;
  }
  return Math.min(60_000, Math.floor(raw));
}

export function resolveWorkerStaleThresholdMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.WORKER_STALE_THRESHOLD_MS);
  if (!Number.isFinite(raw) || raw < 30_000) {
    return DEFAULT_WORKER_STALE_THRESHOLD_MS;
  }
  return Math.min(600_000, Math.floor(raw));
}

export function resolveWorkerHeartbeatIntervalMsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return resolveWorkerHeartbeatIntervalMs(env);
}

export async function registerWorkerInstance(
  input: RegisterWorkerInput,
): Promise<WorkerInstance> {
  const now = new Date();

  return prisma.workerInstance.upsert({
    where: { id: input.workerId },
    create: {
      id: input.workerId,
      hostname: os.hostname(),
      pid: process.pid,
      status: WorkerInstanceStatus.active,
      startedAt: now,
      lastHeartbeatAt: now,
      version: input.version ?? process.env.npm_package_version ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      hostname: os.hostname(),
      pid: process.pid,
      status: WorkerInstanceStatus.active,
      lastHeartbeatAt: now,
      stoppedAt: null,
      version: input.version ?? process.env.npm_package_version ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function heartbeatWorkerInstance(input: {
  workerId: string;
  currentJobId?: string | null;
  jobsProcessed?: number;
  jobsFailed?: number;
}): Promise<WorkerInstance | null> {
  const existing = await prisma.workerInstance.findUnique({
    where: { id: input.workerId },
  });

  if (!existing || existing.status === WorkerInstanceStatus.stopped) {
    return null;
  }

  return prisma.workerInstance.update({
    where: { id: input.workerId },
    data: {
      lastHeartbeatAt: new Date(),
      ...(input.currentJobId !== undefined
        ? { currentJobId: input.currentJobId }
        : {}),
      ...(input.jobsProcessed !== undefined
        ? { jobsProcessed: input.jobsProcessed }
        : {}),
      ...(input.jobsFailed !== undefined
        ? { jobsFailed: input.jobsFailed }
        : {}),
    },
  });
}

export async function markWorkerDraining(workerId: string): Promise<void> {
  await prisma.workerInstance.updateMany({
    where: {
      id: workerId,
      status: WorkerInstanceStatus.active,
    },
    data: {
      status: WorkerInstanceStatus.draining,
      lastHeartbeatAt: new Date(),
    },
  });
}

export async function markWorkerStopped(workerId: string): Promise<void> {
  const now = new Date();

  await prisma.workerInstance.updateMany({
    where: { id: workerId },
    data: {
      status: WorkerInstanceStatus.stopped,
      stoppedAt: now,
      lastHeartbeatAt: now,
      currentJobId: null,
    },
  });
}

export async function incrementWorkerJobCounters(input: {
  workerId: string;
  processed?: number;
  failed?: number;
}): Promise<void> {
  await prisma.workerInstance.updateMany({
    where: { id: input.workerId },
    data: {
      jobsProcessed: input.processed
        ? { increment: input.processed }
        : undefined,
      jobsFailed: input.failed ? { increment: input.failed } : undefined,
      lastHeartbeatAt: new Date(),
    },
  });
}

function toWorkerSummary(
  worker: WorkerInstance,
  staleThresholdMs: number,
  referenceDate: Date = new Date(),
): WorkerInstanceSummary {
  const isStale =
    worker.status !== WorkerInstanceStatus.stopped &&
    referenceDate.getTime() - worker.lastHeartbeatAt.getTime() > staleThresholdMs;

  return {
    id: worker.id,
    hostname: worker.hostname,
    pid: worker.pid,
    status: worker.status,
    startedAt: worker.startedAt.toISOString(),
    lastHeartbeatAt: worker.lastHeartbeatAt.toISOString(),
    uptimeMs: Math.max(0, referenceDate.getTime() - worker.startedAt.getTime()),
    jobsProcessed: worker.jobsProcessed,
    jobsFailed: worker.jobsFailed,
    currentJobId: worker.currentJobId,
    version: worker.version,
    isStale,
  };
}

export async function listWorkerInstances(
  env: NodeJS.ProcessEnv = process.env,
): Promise<WorkerRegistrySnapshot> {
  const staleThresholdMs = resolveWorkerStaleThresholdMs(env);
  const workers = await prisma.workerInstance.findMany({
    where: {
      status: {
        in: [WorkerInstanceStatus.active, WorkerInstanceStatus.draining],
      },
    },
    orderBy: { lastHeartbeatAt: "desc" },
  });

  const summaries = workers.map((worker) =>
    toWorkerSummary(worker, staleThresholdMs),
  );

  return {
    activeWorkers: summaries.filter(
      (worker) => worker.status === WorkerInstanceStatus.active && !worker.isStale,
    ).length,
    drainingWorkers: summaries.filter(
      (worker) => worker.status === WorkerInstanceStatus.draining,
    ).length,
    staleWorkers: summaries.filter((worker) => worker.isStale).length,
    workers: summaries,
  };
}

export async function purgeStoppedWorkers(
  olderThanMs: number = 7 * 24 * 60 * 60 * 1000,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);

  const result = await prisma.workerInstance.deleteMany({
    where: {
      status: WorkerInstanceStatus.stopped,
      stoppedAt: { lt: cutoff },
    },
  });

  if (result.count > 0) {
    console.info(LOG_PREFIX, {
      message: "Purged stopped worker instances",
      operation: "worker_purge",
      count: result.count,
    });
  }

  return result.count;
}

export async function getActiveWorkerIds(
  env: NodeJS.ProcessEnv = process.env,
): Promise<Set<string>> {
  const staleThresholdMs = resolveWorkerStaleThresholdMs(env);
  const cutoff = new Date(Date.now() - staleThresholdMs);

  const workers = await prisma.workerInstance.findMany({
    where: {
      status: {
        in: [WorkerInstanceStatus.active, WorkerInstanceStatus.draining],
      },
      lastHeartbeatAt: { gte: cutoff },
    },
    select: { id: true },
  });

  return new Set(workers.map((worker) => worker.id));
}
