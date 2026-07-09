import { JobPriority, JobType, OnboardingStatus } from "@prisma/client";

import prisma from "../db.server";
import { updateMerchantLearningProfile } from "../operations/operations-metrics";
import { loadOperationsSnapshot, saveOperationsSnapshot } from "../operations/operations-persistence";
import { getExecutiveBrief } from "./executive-brief.server";
import { enqueueJob, releaseStaleJobs } from "./job.server";
import { getStoreMetrics } from "./metrics.server";
import { getStoreRecommendations } from "./recommendations.server";

const DEFAULT_STORE_BATCH_SIZE = 50;
const WEBHOOK_RETENTION_DAYS = 30;

export type CronJobResult = {
  jobId: string;
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
};

function resolveStoreBatchSize(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.CRON_STORE_BATCH_SIZE ?? DEFAULT_STORE_BATCH_SIZE);
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_STORE_BATCH_SIZE;
  }

  return Math.min(200, Math.floor(raw));
}

function dailyBucket(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function hourlyBucket(date = new Date()): string {
  return date.toISOString().slice(0, 13);
}

async function listOnboardedStoreIds(limit: number): Promise<string[]> {
  const rows = await prisma.storeOnboarding.findMany({
    where: { status: OnboardingStatus.completed },
    select: { storeId: true },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });

  return rows.map((row) => row.storeId);
}

async function listActiveStoreIds(limit: number): Promise<string[]> {
  const rows = await prisma.store.findMany({
    where: { active: true },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });

  return rows.map((row) => row.id);
}

export async function runRetryQueueCron(): Promise<CronJobResult> {
  const released = await releaseStaleJobs();

  return {
    jobId: "retry-queue",
    ok: true,
    message: "Retry queue maintenance completed",
    details: {
      staleJobsReleased: released.length,
    },
  };
}

export async function runExpiredSessionsCron(): Promise<CronJobResult> {
  const result = await prisma.session.deleteMany({
    where: {
      expires: {
        lt: new Date(),
      },
    },
  });

  return {
    jobId: "expired-sessions",
    ok: true,
    message: "Expired sessions removed",
    details: {
      deletedCount: result.count,
    },
  };
}

export async function runCleanupJobsCron(): Promise<CronJobResult> {
  const cutoff = new Date(Date.now() - WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const deletedWebhookEvents = await prisma.webhookEvent.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
      processedSuccessfully: true,
    },
  });

  const clearedProcessingLeases = await prisma.webhookEvent.updateMany({
    where: {
      processingExpiresAt: {
        lt: new Date(),
      },
      processingOwner: {
        not: null,
      },
    },
    data: {
      processingOwner: null,
      processingExpiresAt: null,
    },
  });

  return {
    jobId: "cleanup-jobs",
    ok: true,
    message: "Cleanup jobs completed",
    details: {
      deletedWebhookEvents: deletedWebhookEvents.count,
      clearedProcessingLeases: clearedProcessingLeases.count,
      webhookRetentionDays: WEBHOOK_RETENTION_DAYS,
    },
  };
}

export async function runLearningEngineCron(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CronJobResult> {
  const storeIds = await listOnboardedStoreIds(resolveStoreBatchSize(env));
  let updatedStores = 0;
  let processedOperations = 0;

  for (const storeId of storeIds) {
    const snapshot = await loadOperationsSnapshot(storeId);
    const completed = snapshot.operations.filter((operation) =>
      ["completed", "verified"].includes(operation.status),
    );

    if (completed.length === 0) {
      continue;
    }

    let learning = snapshot.learning;
    for (const operation of completed.slice(0, 25)) {
      if (!operation.completedAt) {
        continue;
      }

      const completionMinutes =
        operation.startedAt && operation.completedAt
          ? (new Date(operation.completedAt).getTime() -
              new Date(operation.startedAt).getTime()) /
            60000
          : operation.estimatedMinutes;

      learning = updateMerchantLearningProfile({
        learning,
        operation,
        completionMinutes,
      });
      processedOperations += 1;
    }

    await saveOperationsSnapshot(storeId, {
      ...snapshot,
      learning,
    });
    updatedStores += 1;
  }

  return {
    jobId: "learning-engine",
    ok: true,
    message: "Learning engine profiles refreshed",
    details: {
      storesProcessed: storeIds.length,
      storesUpdated: updatedStores,
      operationsProcessed: processedOperations,
    },
  };
}

export async function runDailyOperatingPlanCron(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CronJobResult> {
  const bucket = dailyBucket();
  const storeIds = await listOnboardedStoreIds(resolveStoreBatchSize(env));
  let enqueued = 0;

  for (const storeId of storeIds) {
    await enqueueJob({
      storeId,
      jobType: JobType.executive_brief_generate,
      idempotencyKey: `cron:daily-operating-plan:${storeId}:${bucket}`,
      maxAttempts: 2,
      priority: JobPriority.high,
      payload: { source: "cron_daily_operating_plan", bucket },
    });
    enqueued += 1;
  }

  return {
    jobId: "daily-operating-plan",
    ok: true,
    message: "Daily operating plan jobs enqueued",
    details: {
      bucket,
      enqueued,
    },
  };
}

export async function runKnowledgeRefreshCron(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CronJobResult> {
  const bucket = dailyBucket();
  const storeIds = await listOnboardedStoreIds(resolveStoreBatchSize(env));
  let enqueued = 0;

  for (const storeId of storeIds) {
    await enqueueJob({
      storeId,
      jobType: JobType.connector_sync,
      idempotencyKey: `cron:knowledge-refresh:${storeId}:${bucket}`,
      maxAttempts: 2,
      priority: JobPriority.normal,
      payload: {
        source: "cron_knowledge_refresh",
        bucket,
        forceRefresh: true,
      },
    });
    enqueued += 1;
  }

  return {
    jobId: "knowledge-refresh",
    ok: true,
    message: "Knowledge refresh jobs enqueued",
    details: {
      bucket,
      enqueued,
    },
  };
}

export async function runMetricsAggregationCron(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CronJobResult> {
  const bucket = hourlyBucket();
  const storeIds = await listActiveStoreIds(resolveStoreBatchSize(env));
  let enqueued = 0;

  for (const storeId of storeIds) {
    await enqueueJob({
      storeId,
      jobType: JobType.metrics_recompute,
      idempotencyKey: `cron:metrics-aggregation:${storeId}:${bucket}`,
      maxAttempts: 2,
      priority: JobPriority.normal,
      payload: { source: "cron_metrics_aggregation", bucket },
    });
    enqueued += 1;
  }

  return {
    jobId: "metrics-aggregation",
    ok: true,
    message: "Metrics aggregation jobs enqueued",
    details: {
      bucket,
      enqueued,
    },
  };
}

export async function runRecommendationRefreshCron(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CronJobResult> {
  const bucket = dailyBucket();
  const storeIds = await listOnboardedStoreIds(resolveStoreBatchSize(env));
  let enqueued = 0;

  for (const storeId of storeIds) {
    await enqueueJob({
      storeId,
      jobType: JobType.recommendations_generate,
      idempotencyKey: `cron:recommendation-refresh:${storeId}:${bucket}`,
      maxAttempts: 2,
      priority: JobPriority.normal,
      payload: { source: "cron_recommendation_refresh", bucket },
    });
    enqueued += 1;
  }

  return {
    jobId: "recommendation-refresh",
    ok: true,
    message: "Recommendation refresh jobs enqueued",
    details: {
      bucket,
      enqueued,
    },
  };
}

export async function executeExecutiveBriefJob(storeId: string): Promise<void> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { currency: true },
  });

  await getExecutiveBrief(storeId, store?.currency ?? "USD");
}

export async function executeMetricsRecomputeJob(storeId: string): Promise<void> {
  await getStoreMetrics(storeId);
}

export async function executeRecommendationsGenerateJob(storeId: string): Promise<void> {
  await getStoreRecommendations(storeId);
}
