import { getCronWorkerHealth } from "./cron-worker.server";
import {
  detectOrphanJobs,
  countRecentCancelledBootstrapJobs,
  getJobQueueMetrics,
  type JobQueueMetrics,
} from "./job.server";
import {
  getExtendedJobQueueMetrics,
  getWorkerRuntimeMetrics,
  type ExtendedJobQueueMetrics,
} from "./worker-metrics.server";
import {
  getActiveWorkerIds,
  listWorkerInstances,
  type WorkerRegistrySnapshot,
} from "./worker-registry.server";
import { getWorkerRuntimeSnapshot } from "./worker-runtime.server";

export type WorkerInfrastructureHealth = {
  ok: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  queue: JobQueueMetrics;
  queueExtended: ExtendedJobQueueMetrics;
  workers: WorkerRegistrySnapshot;
  runtime: ReturnType<typeof getWorkerRuntimeSnapshot>;
  processMetrics: ReturnType<typeof getWorkerRuntimeMetrics>;
  cronFallback: ReturnType<typeof getCronWorkerHealth>;
  orphanJobs: Awaited<ReturnType<typeof detectOrphanJobs>>;
  alerts: string[];
};

function buildAlerts(input: {
  queue: JobQueueMetrics;
  queueExtended: ExtendedJobQueueMetrics;
  workers: WorkerRegistrySnapshot;
  orphanJobs: Awaited<ReturnType<typeof detectOrphanJobs>>;
  cancelledBootstrapJobs: number;
}): string[] {
  const alerts: string[] = [];

  if (input.workers.activeWorkers === 0) {
    alerts.push("no_active_workers");
  }

  if (input.workers.staleWorkers > 0) {
    alerts.push(`stale_workers:${input.workers.staleWorkers}`);
  }

  if (input.queue.deadLetter > 0) {
    alerts.push(`dead_letter_jobs:${input.queue.deadLetter}`);
  }

  if (input.cancelledBootstrapJobs > 0) {
    alerts.push(`cancelled_bootstrap_jobs:${input.cancelledBootstrapJobs}`);
  }

  if (input.queue.cancelled > 0 && input.queue.queued > 0) {
    alerts.push(`cancelled_jobs:${input.queue.cancelled}`);
  }

  if (input.queueExtended.oldestQueuedJobAgeMs !== null) {
    const ageMinutes = Math.floor(
      input.queueExtended.oldestQueuedJobAgeMs / 60_000,
    );
    if (ageMinutes >= 10) {
      alerts.push(`oldest_queued_job_minutes:${ageMinutes}`);
    }
  }

  if (input.orphanJobs.length > 0) {
    alerts.push(`orphan_jobs:${input.orphanJobs.length}`);
  }

  return alerts;
}

function resolveHealthStatus(alerts: string[]): WorkerInfrastructureHealth["status"] {
  if (alerts.some((alert) => alert.startsWith("no_active_workers"))) {
    return "unhealthy";
  }

  if (alerts.length > 0) {
    return "degraded";
  }

  return "healthy";
}

export async function getWorkerInfrastructureHealth(
  env: NodeJS.ProcessEnv = process.env,
): Promise<WorkerInfrastructureHealth> {
  const activeWorkerIds = await getActiveWorkerIds(env);
  const [
    queue,
    queueExtended,
    workers,
    orphanJobs,
    cancelledBootstrapJobs,
  ] = await Promise.all([
    getJobQueueMetrics(),
    getExtendedJobQueueMetrics(),
    listWorkerInstances(env),
    detectOrphanJobs({ activeWorkerIds }),
    countRecentCancelledBootstrapJobs(),
  ]);

  const alerts = buildAlerts({
    queue,
    queueExtended,
    workers,
    orphanJobs,
    cancelledBootstrapJobs,
  });
  const status = resolveHealthStatus(alerts);

  return {
    ok: status !== "unhealthy",
    status,
    timestamp: new Date().toISOString(),
    queue,
    queueExtended,
    workers,
    runtime: getWorkerRuntimeSnapshot(),
    processMetrics: getWorkerRuntimeMetrics(),
    cronFallback: getCronWorkerHealth(env),
    orphanJobs,
    alerts,
  };
}
