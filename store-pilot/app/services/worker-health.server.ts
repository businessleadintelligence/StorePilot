import { getCronWorkerHealth } from "./cron-worker.server";
import {
  detectOrphanJobs,
  countRecentCancelledBootstrapJobs,
  getJobQueueMetrics,
  type JobQueueMetrics,
  type OrphanJobSummary,
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

export type WorkerExecutionMode =
  | "serverless_cron"
  | "continuous_worker"
  | "hybrid";

export type WorkerInfrastructureHealth = {
  ok: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  executionMode: WorkerExecutionMode;
  timestamp: string;
  queue: JobQueueMetrics;
  queueExtended: ExtendedJobQueueMetrics;
  workers: WorkerRegistrySnapshot;
  runtime: ReturnType<typeof getWorkerRuntimeSnapshot>;
  processMetrics: ReturnType<typeof getWorkerRuntimeMetrics>;
  cron: ReturnType<typeof getCronWorkerHealth>;
  orphanJobs: OrphanJobSummary[];
  alerts: string[];
};

function resolveWorkerExecutionMode(input: {
  cronEnabled: boolean;
  activeWorkers: number;
}): WorkerExecutionMode {
  if (input.activeWorkers > 0 && input.cronEnabled) {
    return "hybrid";
  }

  if (input.activeWorkers > 0) {
    return "continuous_worker";
  }

  return "serverless_cron";
}

function filterOrphanJobsForHealth(input: {
  orphanJobs: OrphanJobSummary[];
  cronEnabled: boolean;
}): OrphanJobSummary[] {
  if (!input.cronEnabled) {
    return input.orphanJobs;
  }

  return input.orphanJobs.filter((job) => job.reason === "lock_expired");
}

function buildAlerts(input: {
  queue: JobQueueMetrics;
  queueExtended: ExtendedJobQueueMetrics;
  workers: WorkerRegistrySnapshot;
  orphanJobs: OrphanJobSummary[];
  cancelledBootstrapJobs: number;
  cronEnabled: boolean;
}): string[] {
  const alerts: string[] = [];

  if (input.workers.activeWorkers === 0 && !input.cronEnabled) {
    alerts.push("no_worker_capacity");
  }

  if (
    input.workers.staleWorkers > 0 &&
    input.workers.activeWorkers + input.workers.staleWorkers > 0
  ) {
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
  if (alerts.some((alert) => alert.startsWith("no_worker_capacity"))) {
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
  const cron = getCronWorkerHealth(env);
  const cronEnabled = cron.queueEnabled;
  const activeWorkerIds = cronEnabled
    ? undefined
    : await getActiveWorkerIds(env);
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

  const significantOrphans = filterOrphanJobsForHealth({
    orphanJobs,
    cronEnabled,
  });

  const alerts = buildAlerts({
    queue,
    queueExtended,
    workers,
    orphanJobs: significantOrphans,
    cancelledBootstrapJobs,
    cronEnabled,
  });
  const status = resolveHealthStatus(alerts);

  return {
    ok: status !== "unhealthy",
    status,
    executionMode: resolveWorkerExecutionMode({
      cronEnabled,
      activeWorkers: workers.activeWorkers,
    }),
    timestamp: new Date().toISOString(),
    queue,
    queueExtended,
    workers,
    runtime: getWorkerRuntimeSnapshot(),
    processMetrics: getWorkerRuntimeMetrics(),
    cron,
    orphanJobs: significantOrphans,
    alerts,
  };
}
