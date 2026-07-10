import { JobStatus, type JobType } from "@prisma/client";

import prisma from "../db.server";
import {
  getJobQueueMetrics,
  type JobQueueMetrics,
} from "./job.server";

export type ExtendedJobQueueMetrics = JobQueueMetrics & {
  queueDepth: number;
  oldestQueuedJobAgeMs: number | null;
  longestQueuedJobId: string | null;
  averageWaitTimeMs: number | null;
  averageExecutionTimeMs: number | null;
  totalRetryCount: number;
  throughputLastHour: number;
  byJobType: Partial<Record<JobType, number>>;
};

export type WorkerRuntimeMetrics = {
  cyclesCompleted: number;
  jobsProcessed: number;
  jobsFailed: number;
  lastCycleAt: string | null;
  lastJobAt: string | null;
  startedAt: string;
  uptimeMs: number;
};

const runtimeMetrics: WorkerRuntimeMetrics = {
  cyclesCompleted: 0,
  jobsProcessed: 0,
  jobsFailed: 0,
  lastCycleAt: null,
  lastJobAt: null,
  startedAt: new Date().toISOString(),
  uptimeMs: 0,
};

export function getWorkerRuntimeMetrics(): WorkerRuntimeMetrics {
  return {
    ...runtimeMetrics,
    uptimeMs: Date.now() - new Date(runtimeMetrics.startedAt).getTime(),
  };
}

export function recordWorkerCycleCompleted(processedCount: number): void {
  runtimeMetrics.cyclesCompleted += 1;
  runtimeMetrics.lastCycleAt = new Date().toISOString();
  if (processedCount > 0) {
    runtimeMetrics.jobsProcessed += processedCount;
    runtimeMetrics.lastJobAt = new Date().toISOString();
  }
}

export function recordWorkerJobFailed(count = 1): void {
  runtimeMetrics.jobsFailed += count;
}

export function resetWorkerRuntimeMetricsForTests(): void {
  runtimeMetrics.cyclesCompleted = 0;
  runtimeMetrics.jobsProcessed = 0;
  runtimeMetrics.jobsFailed = 0;
  runtimeMetrics.lastCycleAt = null;
  runtimeMetrics.lastJobAt = null;
  runtimeMetrics.startedAt = new Date().toISOString();
  runtimeMetrics.uptimeMs = 0;
}

export async function getExtendedJobQueueMetrics(): Promise<ExtendedJobQueueMetrics> {
  const base = await getJobQueueMetrics();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [
    oldestQueued,
    waitStats,
    executionStats,
    retryAggregate,
    throughputLastHour,
    byJobTypeRows,
  ] = await Promise.all([
    prisma.syncJob.findFirst({
      where: {
        status: { in: [JobStatus.queued, JobStatus.retrying] },
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true },
    }),
    prisma.$queryRaw<Array<{ avg_wait_ms: number | null }>>`
      SELECT AVG(
        EXTRACT(EPOCH FROM (COALESCE("startedAt", NOW()) - "createdAt")) * 1000
      )::float AS avg_wait_ms
      FROM sync_jobs
      WHERE status IN ('completed'::"JobStatus", 'dead_letter'::"JobStatus")
        AND "startedAt" IS NOT NULL
        AND "createdAt" >= NOW() - INTERVAL '24 hours'
    `,
    prisma.$queryRaw<Array<{ avg_exec_ms: number | null }>>`
      SELECT AVG("durationMs")::float AS avg_exec_ms
      FROM sync_jobs
      WHERE status = 'completed'::"JobStatus"
        AND "durationMs" IS NOT NULL
        AND "completedAt" >= NOW() - INTERVAL '24 hours'
    `,
    prisma.syncJob.aggregate({
      _sum: { attempts: true },
      where: {
        status: {
          in: [
            JobStatus.queued,
            JobStatus.claimed,
            JobStatus.running,
            JobStatus.retrying,
            JobStatus.dead_letter,
          ],
        },
      },
    }),
    prisma.syncJob.count({
      where: {
        status: JobStatus.completed,
        completedAt: { gte: oneHourAgo },
      },
    }),
    prisma.syncJob.groupBy({
      by: ["jobType"],
      where: {
        status: { in: [JobStatus.queued, JobStatus.retrying, JobStatus.claimed, JobStatus.running] },
      },
      _count: { id: true },
    }),
  ]);

  const byJobType: Partial<Record<JobType, number>> = {};
  for (const row of byJobTypeRows) {
    byJobType[row.jobType] = row._count.id;
  }

  const oldestQueuedJobAgeMs = oldestQueued
    ? Date.now() - oldestQueued.createdAt.getTime()
    : null;

  return {
    ...base,
    queueDepth:
      base.queued + base.retrying + base.claimed + base.running,
    oldestQueuedJobAgeMs,
    longestQueuedJobId: oldestQueued?.id ?? null,
    averageWaitTimeMs: waitStats[0]?.avg_wait_ms ?? null,
    averageExecutionTimeMs: executionStats[0]?.avg_exec_ms ?? null,
    totalRetryCount: retryAggregate._sum.attempts ?? 0,
    throughputLastHour,
    byJobType,
  };
}
