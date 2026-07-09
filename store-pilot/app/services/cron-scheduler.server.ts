import type { CronJobResult } from "./cron-jobs.server";
import {
  runCleanupJobsCron,
  runDailyOperatingPlanCron,
  runExpiredSessionsCron,
  runKnowledgeRefreshCron,
  runLearningEngineCron,
  runMetricsAggregationCron,
  runRecommendationRefreshCron,
  runRetryQueueCron,
} from "./cron-jobs.server";

export type CronScheduleDefinition = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  path: string;
  productionSafe: boolean;
};

export type CronDispatchResult = {
  ok: boolean;
  jobId: string;
  timestamp: string;
  result: CronJobResult;
};

type CronRunner = (env?: NodeJS.ProcessEnv) => Promise<CronJobResult>;

const CRON_SCHEDULES: CronScheduleDefinition[] = [
  {
    id: "retry-queue",
    name: "Retry Queue",
    description: "Release stale worker locks and return stuck jobs to the queue",
    schedule: "*/5 * * * *",
    path: "/cron/dispatch/retry-queue",
    productionSafe: true,
  },
  {
    id: "expired-sessions",
    name: "Expired Sessions",
    description: "Delete Shopify sessions past their expiry timestamp",
    schedule: "0 * * * *",
    path: "/cron/dispatch/expired-sessions",
    productionSafe: true,
  },
  {
    id: "cleanup-jobs",
    name: "Cleanup Jobs",
    description: "Purge aged webhook events and clear expired processing leases",
    schedule: "0 2 * * *",
    path: "/cron/dispatch/cleanup-jobs",
    productionSafe: true,
  },
  {
    id: "knowledge-refresh",
    name: "Knowledge Refresh",
    description: "Enqueue connector sync jobs to refresh external knowledge sources",
    schedule: "0 3 * * *",
    path: "/cron/dispatch/knowledge-refresh",
    productionSafe: true,
  },
  {
    id: "learning-engine",
    name: "Learning Engine",
    description: "Update merchant learning profiles from completed operations",
    schedule: "0 4 * * *",
    path: "/cron/dispatch/learning-engine",
    productionSafe: true,
  },
  {
    id: "daily-operating-plan",
    name: "Daily Operating Plan",
    description: "Enqueue executive brief generation for onboarded stores",
    schedule: "0 6 * * *",
    path: "/cron/dispatch/daily-operating-plan",
    productionSafe: true,
  },
  {
    id: "metrics-aggregation",
    name: "Metrics Aggregation",
    description: "Enqueue per-store metrics recompute jobs",
    schedule: "0 */6 * * *",
    path: "/cron/dispatch/metrics-aggregation",
    productionSafe: true,
  },
  {
    id: "recommendation-refresh",
    name: "Recommendation Refresh",
    description: "Enqueue recommendation regeneration jobs for onboarded stores",
    schedule: "0 7,19 * * *",
    path: "/cron/dispatch/recommendation-refresh",
    productionSafe: true,
  },
];

const CRON_RUNNERS: Record<string, CronRunner> = {
  "retry-queue": runRetryQueueCron,
  "expired-sessions": runExpiredSessionsCron,
  "cleanup-jobs": runCleanupJobsCron,
  "knowledge-refresh": runKnowledgeRefreshCron,
  "learning-engine": runLearningEngineCron,
  "daily-operating-plan": runDailyOperatingPlanCron,
  "metrics-aggregation": runMetricsAggregationCron,
  "recommendation-refresh": runRecommendationRefreshCron,
};

export function listCronSchedules(): CronScheduleDefinition[] {
  return CRON_SCHEDULES.map((schedule) => ({ ...schedule }));
}

export function getCronSchedule(jobId: string): CronScheduleDefinition | null {
  return CRON_SCHEDULES.find((schedule) => schedule.id === jobId) ?? null;
}

export function isRegisteredCronJob(jobId: string): boolean {
  return jobId in CRON_RUNNERS;
}

export async function dispatchCronJob(
  jobId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CronDispatchResult> {
  const runner = CRON_RUNNERS[jobId];
  if (!runner) {
    throw new Error(`unknown_cron_job:${jobId}`);
  }

  const result = await runner(env);

  return {
    ok: result.ok,
    jobId,
    timestamp: new Date().toISOString(),
    result,
  };
}

export const WORKER_CRON_SCHEDULE: CronScheduleDefinition = {
  id: "worker",
  name: "Worker Queue",
  description: "Process queued sync jobs via the worker engine",
  schedule: "*/2 * * * *",
  path: "/cron/worker",
  productionSafe: true,
};

export function listAllProductionSchedules(): CronScheduleDefinition[] {
  return [WORKER_CRON_SCHEDULE, ...listCronSchedules()];
}
