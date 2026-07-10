import { JobPriority, JobType, OnboardingStatus } from "@prisma/client";

import prisma from "../db.server";
import { updateMerchantLearningProfile } from "../operations/operations-metrics";
import { loadOperationsSnapshot, saveOperationsSnapshot } from "../operations/operations-persistence";
import { enqueueJob, releaseStaleJobs } from "./job.server";
import { getStoreMetrics } from "./metrics.server";
import { getStoreRecommendations } from "./recommendations.server";
import {
  purgeAgedOperationalRecords,
  scanPersistedJsonForCustomerPii,
} from "./privacy-retention.server";
import {
  detectShopifyScopeDrift,
  formatScopeDriftAlert,
} from "./scope-drift-monitor.server";
import { migratePlaintextSecretTokens } from "./token-migration.server";

const DEFAULT_STORE_BATCH_SIZE = 50;
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
  const retention = await purgeAgedOperationalRecords();

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
      ...retention,
      clearedProcessingLeases: clearedProcessingLeases.count,
    },
  };
}

export async function runPrivacyPiiScanCron(): Promise<CronJobResult> {
  const scan = await scanPersistedJsonForCustomerPii();

  if (scan.violations.length > 0) {
    console.warn("[privacy-pii-scan]", {
      operation: "json_pii_scan_violations",
      samplesScanned: scan.samplesScanned,
      violationCount: scan.violations.length,
      violations: scan.violations.slice(0, 10),
    });
  }

  return {
    jobId: "privacy-pii-scan",
    ok: scan.violations.length === 0,
    message:
      scan.violations.length === 0
        ? "JSON PII scan clean"
        : "JSON PII scan found violations",
    details: {
      samplesScanned: scan.samplesScanned,
      violationCount: scan.violations.length,
      violations: scan.violations.slice(0, 10),
    },
  };
}

export async function runScopeDriftMonitorCron(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CronJobResult> {
  const report = detectShopifyScopeDrift(env);

  if (!report.ok) {
    console.error("[scope-drift-monitor]", {
      operation: "shopify_scope_drift_detected",
      alert: formatScopeDriftAlert(report),
      report,
    });
  }

  return {
    jobId: "scope-drift-monitor",
    ok: report.ok,
    message: report.ok ? "Shopify scopes aligned" : formatScopeDriftAlert(report),
    details: report as unknown as Record<string, unknown>,
  };
}

export async function runTokenMigrationCron(): Promise<CronJobResult> {
  const migration = await migratePlaintextSecretTokens();

  return {
    jobId: "token-migration",
    ok: !migration.skipped,
    message: migration.skipped
      ? "Token migration skipped (encryption key missing)"
      : "Token migration completed",
    details: migration as unknown as Record<string, unknown>,
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

import { scheduleExecutiveCooJob } from "../executive/scheduler/executive-scheduler";

export async function executeExecutiveBriefJob(storeId: string): Promise<void> {
  void scheduleExecutiveCooJob({
    storeId,
    idempotencyKey: `executive:coo:morning:${storeId}:${new Date().toISOString().slice(0, 10)}`,
  }).catch(() => undefined);
}

export async function executeMetricsRecomputeJob(storeId: string): Promise<void> {
  await getStoreMetrics(storeId);
}

export async function executeRecommendationsGenerateJob(storeId: string): Promise<void> {
  await getStoreRecommendations(storeId);
}
