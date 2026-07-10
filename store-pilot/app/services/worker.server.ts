import { JobStatus, JobType, type SyncJob } from "@prisma/client";

import prisma from "../db.server";
import { syncStoreConnectors } from "../connectors/core/connector-sync-engine";
import { runPostAuthBootstrap } from "./after-auth-bootstrap.server";
import { unauthenticated } from "../shopify.server";
import {
  BILLING_LIMIT_EXCEEDED,
} from "./billing-enforcement.server";
import { syncInventoryFromShopify } from "./inventory.server";
import {
  JobWorkerOwnershipError,
  beginJobExecution,
  claimNextJob,
  completeJob,
  extendJobLock,
  failJob,
  releaseStaleJobs,
} from "./job.server";
import {
  finalizeBlockedJobPhase,
  finalizeFailedOnboardingJob,
  finalizeSuccessfulJobPhase,
  markOnboardingOwnershipRepairCandidate,
  markPhaseStarted,
  reconcileOnboardingWithCompletedJobs,
  repairOwnershipConflictOnboarding,
  type OnboardingPhase,
} from "./onboarding.server";
import { syncOrdersFromShopify, syncOrdersIncremental } from "./orders.server";
import {
  nextOrdersIncrementalAvailableAt,
  scheduleOrdersIncrementalSync,
} from "./orders-scheduler.server";
import {
  executeExecutiveBriefJob,
  executeMetricsRecomputeJob,
  executeRecommendationsGenerateJob,
} from "./cron-jobs.server";
import { syncProductsFromShopify } from "./product.server";
import { executeKnowledgeIngestJob, scheduleKnowledgeIngestJob } from "../knowledge/scheduler/knowledge-scheduler";
import {
  executeGraphBuildJob,
  scheduleGraphBuildJob,
} from "../knowledge/graph/scheduler/graph-scheduler";
import { executeLearningBootstrapJob } from "../learning/scheduler/learning-bootstrap-scheduler";
import {
  executeHistoricalIntelligenceJob,
  scheduleHistoricalIntelligenceJob,
} from "../learning/historical/scheduler/historical-scheduler";
import {
  executeQuickWinsGenerateJob,
  scheduleQuickWinsGenerateJob,
} from "../learning/quick-wins/scheduler/quick-wins-scheduler";
import {
  executeExecutiveDecisionJob,
  executeExecutiveCooGenerateJob,
  scheduleExecutiveDecisionJob,
} from "../executive/scheduler/executive-scheduler";
import {
  executeRootCauseGenerateJob,
} from "../root-cause/scheduler/root-cause-scheduler";
import {
  executePredictionGenerateJob,
} from "../prediction/scheduler/prediction-scheduler";
import {
  executeExperimentGenerateJob,
} from "../experiments/scheduler/experiment-scheduler";
import {
  executeMerchantIntelligenceRefreshJob,
} from "../merchant-intelligence/scheduler/merchant-intelligence-scheduler";
import type { StoreSyncAdminClient } from "./store.server";
import { assertStartupReadiness } from "./startup-readiness.server";
import { trackInFlightJob } from "./worker-in-flight.server";

const LOG_PREFIX = "[worker]";
const JOB_HEARTBEAT_INTERVAL_MS = 60_000;

type LogLevel = "info" | "warn" | "error";

type WorkerLogContext = {
  workerId: string;
  storeId?: string;
  jobId?: string;
  jobType?: JobType;
  operation:
    | "worker_started"
    | "job_claimed"
    | "job_completed"
    | "job_failed"
    | "job_dead_lettered"
    | "job_blocked"
    | "billing_limit_reached"
    | "ownership_conflict"
    | "onboarding_reconciled"
    | "worker_cycle_completed";
  reason?: string;
  status?: WorkerJobResult["status"];
  repairedCount?: number;
};

export type WorkerJobResult = {
  jobId: string;
  jobType: JobType;
  status:
    | "completed"
    | "failed"
    | "dead_letter"
    | "unknown"
    | "ownership_conflict"
    | "blocked";
  workerId: string;
};

export type RunWorkerCycleResult = {
  workerId: string;
  processed: WorkerJobResult | null;
  processedCount: number;
  processedJobs: WorkerJobResult[];
  repairedOnboardingCount: number;
};

function resolveWorkerBatchSize(): number {
  const raw = Number(process.env.CRON_JOB_BATCH_SIZE ?? 3);
  if (!Number.isFinite(raw) || raw < 1) {
    return 1;
  }
  return Math.min(10, Math.floor(raw));
}

const JOB_TYPE_TO_PHASE: Partial<Record<JobType, Exclude<OnboardingPhase, "COMPLETE">>> = {
  [JobType.bootstrap_products]: "PRODUCTS",
  [JobType.bootstrap_inventory]: "INVENTORY",
  [JobType.orders_historical]: "ORDERS",
};

function logWorker(
  level: LogLevel,
  message: string,
  context: WorkerLogContext,
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

async function resolveStoreExecutionContext(storeId: string): Promise<{
  shop: string;
  admin: StoreSyncAdminClient;
}> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      shopifyDomain: true,
      active: true,
    },
  });

  if (!store?.active) {
    throw new Error(
      !store ? `Store not found: ${storeId}` : `Store inactive: ${storeId}`,
    );
  }

  const { admin } = await unauthenticated.admin(store.shopifyDomain);

  return {
    shop: store.shopifyDomain,
    admin,
  };
}

export class JobHeartbeatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobHeartbeatError";
  }
}

async function withJobHeartbeat<T>(
  job: SyncJob,
  workerId: string,
  workerGeneration: number,
  work: () => Promise<T>,
): Promise<T> {
  await extendJobLock({
    jobId: job.id,
    storeId: job.storeId,
    workerId,
    workerGeneration,
  });

  let heartbeatFailure: unknown = null;

  const interval = setInterval(() => {
    void extendJobLock({
      jobId: job.id,
      storeId: job.storeId,
      workerId,
      workerGeneration,
    }).catch((error) => {
      heartbeatFailure = error;
    });
  }, JOB_HEARTBEAT_INTERVAL_MS);

  try {
    const result = await work();

    if (heartbeatFailure) {
      throw new JobHeartbeatError(
        heartbeatFailure instanceof Error
          ? heartbeatFailure.message
          : "job_heartbeat_failed",
      );
    }

    return result;
  } finally {
    clearInterval(interval);
  }
}

async function buildOwnershipConflictResult(
  job: SyncJob,
  workerId: string,
  error: JobWorkerOwnershipError,
): Promise<WorkerJobResult> {
  if (JOB_TYPE_TO_PHASE[job.jobType]) {
    await markOnboardingOwnershipRepairCandidate(job.storeId, job.id);
  }

  logWorker("warn", "Worker ownership conflict during job finalization", {
    workerId,
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    operation: "ownership_conflict",
    reason: error.message,
    status: "ownership_conflict",
  });

  return {
    jobId: job.id,
    jobType: job.jobType,
    status: "ownership_conflict",
    workerId,
  };
}

async function handleJobFailure(
  job: SyncJob,
  workerId: string,
  error: unknown,
): Promise<SyncJob> {
  const errorMessage =
    error instanceof Error ? error.message : "unknown_worker_error";

  const phase = JOB_TYPE_TO_PHASE[job.jobType];

  if (phase) {
    const { job: failedJob, markedFailed } = await finalizeFailedOnboardingJob({
      jobId: job.id,
      storeId: job.storeId,
      workerId,
      phase,
      errorCode: "worker_execution_failed",
      errorMessage,
    });

    if (markedFailed) {
      logWorker("error", "Job moved to dead letter", {
        workerId,
        storeId: job.storeId,
        jobId: job.id,
        jobType: job.jobType,
        operation: "job_dead_lettered",
        reason: errorMessage,
        status: "dead_letter",
      });
    } else {
      logWorker("warn", "Job failed and scheduled for retry", {
        workerId,
        storeId: job.storeId,
        jobId: job.id,
        jobType: job.jobType,
        operation: "job_failed",
        reason: errorMessage,
        status: "failed",
      });
    }

    return failedJob;
  }

  const failedJob = await failJob({
    jobId: job.id,
    storeId: job.storeId,
    workerId,
    errorCode: "worker_execution_failed",
    errorMessage,
  });

  logWorker("warn", "Job failed and scheduled for retry", {
    workerId,
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    operation: "job_failed",
    reason: errorMessage,
    status: "failed",
  });

  return failedJob;
}

async function handleUnknownJobType(
  job: SyncJob,
  workerId: string,
): Promise<WorkerJobResult> {
  const failedJob = await failJob({
    jobId: job.id,
    storeId: job.storeId,
    workerId,
    errorCode: "unknown_job_type",
    errorMessage: `Unsupported job type: ${job.jobType}`,
  });

  const status =
    failedJob.status === JobStatus.dead_letter ? "dead_letter" : "unknown";

  logWorker(status === "dead_letter" ? "error" : "warn", "Unknown job type failed", {
    workerId,
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    operation:
      status === "dead_letter" ? "job_dead_lettered" : "job_failed",
    reason: failedJob.errorMessage ?? "unknown_job_type",
    status,
  });

  return {
    jobId: job.id,
    jobType: job.jobType,
    status,
    workerId,
  };
}

async function finalizeSuccessfulOnboardingJob(
  job: SyncJob,
  workerId: string,
  workerGeneration: number,
  phase: Exclude<OnboardingPhase, "COMPLETE">,
  durationMs: number,
): Promise<WorkerJobResult> {
  try {
    await finalizeSuccessfulJobPhase({
      jobId: job.id,
      storeId: job.storeId,
      workerId,
      workerGeneration,
      phase,
      durationMs,
    });
  } catch (error) {
    if (error instanceof JobWorkerOwnershipError) {
      return await buildOwnershipConflictResult(job, workerId, error);
    }

    throw error;
  }

  logWorker("info", "Job completed successfully", {
    workerId,
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    operation: "job_completed",
    status: "completed",
  });

  return {
    jobId: job.id,
    jobType: job.jobType,
    status: "completed",
    workerId,
  };
}

async function finalizeSuccessfulStandaloneJob(
  job: SyncJob,
  workerId: string,
  durationMs: number,
): Promise<WorkerJobResult> {
  try {
    await completeJob({
      jobId: job.id,
      storeId: job.storeId,
      workerId,
      durationMs,
    });
  } catch (error) {
    if (error instanceof JobWorkerOwnershipError) {
      return buildOwnershipConflictResult(job, workerId, error);
    }

    throw error;
  }

  logWorker("info", "Standalone job completed successfully", {
    workerId,
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    operation: "job_completed",
    status: "completed",
  });

  return {
    jobId: job.id,
    jobType: job.jobType,
    status: "completed",
    workerId,
  };
}

async function finalizeBlockedOrdersSyncJob(
  job: SyncJob,
  workerId: string,
  blockedReason: string,
  blockedMessage: string,
  durationMs: number,
): Promise<WorkerJobResult> {
  const isBillingLimit = blockedReason === BILLING_LIMIT_EXCEEDED;
  const logOperation = isBillingLimit ? "billing_limit_reached" : "job_blocked";
  const logMessage = isBillingLimit
    ? "Orders sync job blocked due to plan limit"
    : "Orders sync job blocked due to permanent access failure";

  if (job.jobType === JobType.orders_historical) {
    return finalizeBlockedOnboardingJob(
      job,
      workerId,
      "ORDERS",
      blockedReason,
      blockedMessage,
      durationMs,
      {
        logOperation,
        logMessage: isBillingLimit
          ? "Orders job blocked due to plan limit"
          : "Orders job blocked due to permanent access failure",
      },
    );
  }

  try {
    await completeJob({
      jobId: job.id,
      storeId: job.storeId,
      workerId,
      durationMs,
    });
  } catch (error) {
    if (error instanceof JobWorkerOwnershipError) {
      return buildOwnershipConflictResult(job, workerId, error);
    }

    throw error;
  }

  logWorker("warn", logMessage, {
    workerId,
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    operation: logOperation,
    reason: blockedReason,
    status: "blocked",
  });

  return {
    jobId: job.id,
    jobType: job.jobType,
    status: "blocked",
    workerId,
  };
}

async function finalizeBlockedOnboardingJob(
  job: SyncJob,
  workerId: string,
  phase: Exclude<OnboardingPhase, "COMPLETE">,
  blockedReason: string,
  blockedMessage: string,
  durationMs: number,
  options?: {
    logOperation?: "job_blocked" | "billing_limit_reached";
    logMessage?: string;
  },
): Promise<WorkerJobResult> {
  const logOperation = options?.logOperation ?? "job_blocked";
  const logMessage =
    options?.logMessage ??
    (logOperation === "billing_limit_reached"
      ? "Onboarding job blocked due to plan limit"
      : "Onboarding job blocked due to permanent access failure");

  try {
    await finalizeBlockedJobPhase({
      jobId: job.id,
      storeId: job.storeId,
      workerId,
      phase,
      blockedReason,
      blockedMessage,
      durationMs,
    });
  } catch (error) {
    if (error instanceof JobWorkerOwnershipError) {
      return buildOwnershipConflictResult(job, workerId, error);
    }

    throw error;
  }

  logWorker("warn", logMessage, {
    workerId,
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    operation: logOperation,
    reason: blockedReason,
    status: "blocked",
  });

  return {
    jobId: job.id,
    jobType: job.jobType,
    status: "blocked",
    workerId,
  };
}

async function executeKnownJob(
  job: SyncJob,
  workerId: string,
  workerGeneration: number,
): Promise<WorkerJobResult> {
  const { shop, admin } = await resolveStoreExecutionContext(job.storeId);
  const startedAt = Date.now();

  return withJobHeartbeat(job, workerId, workerGeneration, async () => {
    switch (job.jobType) {
      case JobType.bootstrap_products: {
        const result = await syncProductsFromShopify({
          storeId: job.storeId,
          shop,
          admin,
        });

        if (result.blocked) {
          return finalizeBlockedOnboardingJob(
            job,
            workerId,
            "PRODUCTS",
            result.blockedReason ?? BILLING_LIMIT_EXCEEDED,
            result.blockedMessage ?? "Product sync blocked",
            Date.now() - startedAt,
            result.blockedReason === BILLING_LIMIT_EXCEEDED
              ? {
                  logOperation: "billing_limit_reached",
                  logMessage: "Products job blocked due to plan limit",
                }
              : undefined,
          );
        }

        if (!result.success) {
          throw new Error("bootstrap_products_sync_failed");
        }

        void scheduleKnowledgeIngestJob({
          storeId: job.storeId,
          shop,
          syncMode: "initial_import",
          idempotencyKey: `knowledge:initial:${job.storeId}`,
          priority: "normal",
        }).catch(() => undefined);

        const phase = JOB_TYPE_TO_PHASE[job.jobType];
        if (phase) {
          return finalizeSuccessfulOnboardingJob(
            job,
            workerId,
            workerGeneration,
            phase,
            Date.now() - startedAt,
          );
        }

        break;
      }
      case JobType.bootstrap_inventory: {
        const result = await syncInventoryFromShopify({
          storeId: job.storeId,
          shop,
          admin,
        });

        if (!result.success || result.skipped > 0) {
          throw new Error("bootstrap_inventory_sync_failed");
        }

        const phase = JOB_TYPE_TO_PHASE[job.jobType];
        if (phase) {
          return finalizeSuccessfulOnboardingJob(
            job,
            workerId,
            workerGeneration,
            phase,
            Date.now() - startedAt,
          );
        }

        break;
      }
      case JobType.orders_historical: {
        const result = await syncOrdersFromShopify({
          storeId: job.storeId,
          shop,
          admin,
        });

        if (result.blocked) {
          return finalizeBlockedOrdersSyncJob(
            job,
            workerId,
            result.blockedReason ?? "access_denied",
            result.blockedMessage ?? "Orders sync blocked",
            Date.now() - startedAt,
          );
        }

        if (!result.success) {
          throw new Error("orders_historical_sync_failed");
        }

        return finalizeSuccessfulOnboardingJob(
          job,
          workerId,
          workerGeneration,
          "ORDERS",
          Date.now() - startedAt,
        );
      }
      case JobType.orders_incremental: {
        const result = await syncOrdersIncremental({
          storeId: job.storeId,
          shop,
          admin,
        });

        if (result.blocked) {
          return finalizeBlockedOrdersSyncJob(
            job,
            workerId,
            result.blockedReason ?? "access_denied",
            result.blockedMessage ?? "Orders sync blocked",
            Date.now() - startedAt,
          );
        }

        if (!result.success) {
          throw new Error("orders_incremental_sync_failed");
        }

        await scheduleOrdersIncrementalSync(
          job.storeId,
          nextOrdersIncrementalAvailableAt(),
        );

        return finalizeSuccessfulStandaloneJob(
          job,
          workerId,
          Date.now() - startedAt,
        );
      }
      case JobType.connector_sync: {
        const payload = (job.payload ?? {}) as {
          connectorIds?: Array<"ga4" | "gsc" | "pagespeed" | "clarity">;
          forceRefresh?: boolean;
        };
        const syncResult = await syncStoreConnectors(
          { storeId: job.storeId },
          {
            connectorIds: payload.connectorIds,
            forceRefresh: payload.forceRefresh ?? false,
            useCache: false,
          },
        );

        const failedRuns = syncResult.runs.filter((run) => run.status === "failed");
        if (failedRuns.length > 0) {
          throw new Error(
            `connector_sync_failed:${failedRuns.map((run) => run.connectorId).join(",")}`,
          );
        }

        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.executive_brief_generate: {
        await executeExecutiveBriefJob(job.storeId);
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.metrics_recompute: {
        await executeMetricsRecomputeJob(job.storeId);
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.recommendations_generate: {
        await executeRecommendationsGenerateJob(job.storeId);
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.founder_maintenance: {
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.onboarding_bootstrap: {
        await runPostAuthBootstrap({
          storeId: job.storeId,
          shop,
          admin,
        });
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.knowledge_ingest:
      case JobType.knowledge_fact_refresh: {
        const payload = (job.payload ?? {}) as {
          shop?: string;
          syncMode?: import("@prisma/client").KnowledgeSyncMode;
        };
        const result = await executeKnowledgeIngestJob({
          storeId: job.storeId,
          shop: payload.shop ?? shop,
          syncMode:
            payload.syncMode ??
            (job.jobType === JobType.knowledge_fact_refresh
              ? "fact_refresh"
              : "incremental"),
          admin,
        });
        if (!result.success) {
          throw new Error("knowledge_ingest_failed");
        }
        if (result.hasMoreWork) {
          await scheduleKnowledgeIngestJob({
            storeId: job.storeId,
            shop: payload.shop ?? shop,
            syncMode:
              payload.syncMode ??
              (job.jobType === JobType.knowledge_fact_refresh
                ? "fact_refresh"
                : "incremental"),
            idempotencyKey: `knowledge:continue:${job.storeId}:${result.productsProcessed}:${result.ordersProcessed}`,
          });
        } else {
          void scheduleGraphBuildJob({
            storeId: job.storeId,
            idempotencyKey: `graph:after-ingest:${job.storeId}`,
          }).catch(() => undefined);
        }
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.knowledge_graph_build:
      case JobType.knowledge_graph_incremental: {
        const payload = (job.payload ?? {}) as {
          entityType?: string;
          entityId?: string;
        };
        const graphResult = await executeGraphBuildJob({
          storeId: job.storeId,
          incremental: job.jobType === JobType.knowledge_graph_incremental,
          entityType: payload.entityType,
          entityId: payload.entityId,
          resumeFromCheckpoint: true,
        });
        if (graphResult.hasMoreWork) {
          await scheduleGraphBuildJob({
            storeId: job.storeId,
            incremental: job.jobType === JobType.knowledge_graph_incremental,
            entityType: payload.entityType,
            entityId: payload.entityId,
            idempotencyKey: `graph:continue:${job.storeId}:${graphResult.evidenceProcessed}`,
          });
        } else if (job.jobType === JobType.knowledge_graph_build) {
          void scheduleHistoricalIntelligenceJob({
            storeId: job.storeId,
            graphVersion: graphResult.snapshotVersion,
            idempotencyKey: `historical:after-graph:${job.storeId}`,
          }).catch(() => undefined);
        }
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.historical_intelligence: {
        const payload = (job.payload ?? {}) as {
          graphVersion?: number;
          snapshotVersion?: number;
        };
        await executeHistoricalIntelligenceJob({
          storeId: job.storeId,
          graphVersion: payload.graphVersion,
          snapshotVersion: payload.snapshotVersion,
        });
        void scheduleQuickWinsGenerateJob({
          storeId: job.storeId,
          graphVersion: payload.graphVersion,
          idempotencyKey: `quick-wins:after-historical:${job.storeId}`,
        }).catch(() => undefined);
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.quick_wins_generate: {
        await executeQuickWinsGenerateJob({
          storeId: job.storeId,
        });
        void scheduleExecutiveDecisionJob({
          storeId: job.storeId,
          idempotencyKey: `executive:after-quick-wins:${job.storeId}`,
        }).catch(() => undefined);
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.executive_decision_generate: {
        await executeExecutiveDecisionJob({
          storeId: job.storeId,
        });
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.executive_coo_generate: {
        const payload = (job.payload ?? {}) as { contextSnapshotId?: string };
        await executeExecutiveCooGenerateJob({
          storeId: job.storeId,
          contextSnapshotId: payload.contextSnapshotId,
        });
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.merchant_intelligence_refresh: {
        await executeMerchantIntelligenceRefreshJob({
          storeId: job.storeId,
        });
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.experiment_generate: {
        const payload = (job.payload ?? {}) as { contextSnapshotId?: string };
        await executeExperimentGenerateJob({
          storeId: job.storeId,
          contextSnapshotId: payload.contextSnapshotId,
        });
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.prediction_generate: {
        const payload = (job.payload ?? {}) as { contextSnapshotId?: string };
        await executePredictionGenerateJob({
          storeId: job.storeId,
          contextSnapshotId: payload.contextSnapshotId,
        });
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.root_cause_generate: {
        const payload = (job.payload ?? {}) as { contextSnapshotId?: string };
        await executeRootCauseGenerateJob({
          storeId: job.storeId,
          contextSnapshotId: payload.contextSnapshotId,
        });
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      case JobType.learning_bootstrap: {
        await executeLearningBootstrapJob({
          storeId: job.storeId,
          admin,
        });
        return finalizeSuccessfulStandaloneJob(job, workerId, Date.now() - startedAt);
      }
      default:
        return handleUnknownJobType(job, workerId);
    }

    throw new Error(`Unsupported onboarding finalize for job type: ${job.jobType}`);
  });
}

export async function prepareWorkerQueue(workerId: string): Promise<number> {
  await releaseStaleJobs();

  const ownershipRepaired = await repairOwnershipConflictOnboarding();
  if (ownershipRepaired > 0) {
    logWorker("warn", "Repaired onboarding rows after ownership conflict", {
      workerId,
      operation: "onboarding_reconciled",
      repairedCount: ownershipRepaired,
    });
  }

  const repairedOnboardingCount = await reconcileOnboardingWithCompletedJobs();
  if (repairedOnboardingCount > 0) {
    logWorker("warn", "Repaired onboarding rows with completed current jobs", {
      workerId,
      operation: "onboarding_reconciled",
      repairedCount: repairedOnboardingCount,
    });
  }

  return repairedOnboardingCount;
}

async function executeNextClaimedJob(
  workerId: string,
): Promise<WorkerJobResult | null> {
  const claim = await claimNextJob({ workerId });
  if (!claim) {
    return null;
  }

  let job = claim.job;

  logWorker("info", "Job claimed for execution", {
    workerId,
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    operation: "job_claimed",
  });

  try {
    job = await beginJobExecution({
      jobId: job.id,
      storeId: job.storeId,
      workerId,
      workerGeneration: claim.workerGeneration,
    });

    const onboardingPhase = JOB_TYPE_TO_PHASE[job.jobType];
    if (onboardingPhase) {
      await markPhaseStarted(job.storeId, onboardingPhase);
    }

    trackInFlightJob(job.id);
    return await executeKnownJob(job, workerId, claim.workerGeneration);
  } catch (error) {
    if (error instanceof JobWorkerOwnershipError) {
      return await buildOwnershipConflictResult(job, workerId, error);
    }

    try {
      const failedJob = await handleJobFailure(job, workerId, error);

      return {
        jobId: job.id,
        jobType: job.jobType,
        status:
          failedJob.status === JobStatus.dead_letter
            ? "dead_letter"
            : failedJob.status === JobStatus.retrying
              ? "failed"
              : "failed",
        workerId,
      };
    } catch (failureError) {
      if (failureError instanceof JobWorkerOwnershipError) {
        return await buildOwnershipConflictResult(job, workerId, failureError);
      }

      throw failureError;
    }
  } finally {
    trackInFlightJob(null);
  }
}

export async function runNextJob(
  workerId: string,
): Promise<WorkerJobResult | null> {
  await prepareWorkerQueue(workerId);
  return executeNextClaimedJob(workerId);
}

export async function runWorkerCycle(
  workerId: string,
): Promise<RunWorkerCycleResult> {
  return runWorkerBatch(workerId, resolveWorkerBatchSize());
}

export async function runWorkerBatch(
  workerId: string,
  batchSize = resolveWorkerBatchSize(),
): Promise<RunWorkerCycleResult> {
  await assertStartupReadiness();

  logWorker("info", "Worker cycle started", {
    workerId,
    operation: "worker_started",
  });

  const repairedOnboardingCount = await prepareWorkerQueue(workerId);
  const processedJobs: WorkerJobResult[] = [];

  for (let index = 0; index < batchSize; index += 1) {
    const processed = await executeNextClaimedJob(workerId);
    if (!processed) {
      break;
    }
    processedJobs.push(processed);
  }

  const processed = processedJobs.at(-1) ?? null;

  logWorker("info", "Worker cycle completed", {
    workerId,
    jobId: processed?.jobId,
    jobType: processed?.jobType,
    operation: "worker_cycle_completed",
    status: processed?.status,
  });

  return {
    workerId,
    processed,
    processedCount: processedJobs.length,
    processedJobs,
    repairedOnboardingCount,
  };
}
