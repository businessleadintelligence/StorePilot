import { JobStatus } from "@prisma/client";

import prisma from "../db.server";
import { getCronWorkerHealth } from "../services/cron-worker.server";
import { buildSubsystemHealth, levelFromFailureCount } from "./production-checks";
import type { ProductionSubsystemHealth } from "./production-types";

export async function monitorBackgroundJobs(storeId: string): Promise<ProductionSubsystemHealth> {
  const [queued, running, retrying, failed, deadLetter, oldestQueued, avgDuration] = await Promise.all([
    prisma.syncJob.count({ where: { storeId, status: JobStatus.queued } }),
    prisma.syncJob.count({ where: { storeId, status: JobStatus.running } }),
    prisma.syncJob.count({ where: { storeId, status: JobStatus.retrying } }),
    prisma.syncJob.count({ where: { storeId, status: JobStatus.failed } }),
    prisma.syncJob.count({ where: { storeId, status: JobStatus.dead_letter } }),
    prisma.syncJob.findFirst({
      where: { storeId, status: { in: [JobStatus.queued, JobStatus.retrying] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.syncJob.aggregate({
      where: { storeId, durationMs: { not: null } },
      _avg: { durationMs: true },
    }),
  ]);

  const failureCount = failed + deadLetter;
  const level = deadLetter > 0 ? "critical" : levelFromFailureCount(failureCount, 3);

  return buildSubsystemHealth({
    id: "background_jobs",
    label: "Background Jobs",
    level,
    failureCount,
    retryCount: retrying,
    averageLatencyMs: avgDuration._avg.durationMs ? Math.round(avgDuration._avg.durationMs) : null,
    recoverySuggestion:
      deadLetter > 0 ? "Review dead-letter jobs and retry failed sync operations" : null,
    nextRetry: oldestQueued?.createdAt.toISOString() ?? null,
    details: {
      queued,
      running,
      retrying,
      failed,
      deadLetter,
      queueLength: queued + retrying,
    },
  });
}

export async function monitorWorkerQueue(): Promise<ProductionSubsystemHealth> {
  const cronHealth = getCronWorkerHealth();
  return buildSubsystemHealth({
    id: "worker_queue",
    label: "Worker Queue",
    level: cronHealth.queueEnabled && cronHealth.cronSecretConfigured ? "healthy" : "critical",
    lastError: cronHealth.reason ?? null,
    recoverySuggestion: cronHealth.queueEnabled
      ? null
      : "Configure CRON_SECRET and enable worker queue processing",
    details: {
      queueEnabled: cronHealth.queueEnabled,
      cronSecretConfigured: cronHealth.cronSecretConfigured,
    },
  });
}
