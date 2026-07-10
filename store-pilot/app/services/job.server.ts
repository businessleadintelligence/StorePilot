import {
  JobEventActor,
  JobEventType,
  JobPriority,
  JobStatus,
  JobType,
  OnboardingPhaseStatus,
  OnboardingStatus,
  Prisma,
  type SyncJob,
} from "@prisma/client";

import { isEphemeralCronWorkerId } from "./cron-worker.server";
import prisma from "../db.server";

const LOG_PREFIX = "[job-service]";
export const DEFAULT_LOCK_DURATION_MS = 5 * 60 * 1000;
export const STALE_HEARTBEAT_GRACE_MULTIPLIER = 2;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;
const DEFAULT_RETRY_JITTER_MS = 5_000;

export function resolveLockDurationMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.JOB_LOCK_DURATION_MS);
  if (!Number.isFinite(raw) || raw < 60_000) {
    return DEFAULT_LOCK_DURATION_MS;
  }
  return Math.min(30 * 60 * 1000, Math.floor(raw));
}

type LogLevel = "info" | "warn" | "error";

type JobLogContext = {
  storeId?: string;
  jobId?: string;
  jobType?: JobType;
  workerId?: string;
  operation:
    | "job_enqueued"
    | "job_claimed"
    | "job_completed"
    | "job_failed"
    | "job_retried"
    | "job_dead_lettered"
    | "job_cancelled"
    | "job_heartbeat"
    | "stale_job_released"
    | "store_jobs_cancelled";
  reason?: string;
  duplicate?: boolean;
};

export function isTerminalJobStatus(status: JobStatus): boolean {
  return (
    status === JobStatus.completed ||
    status === JobStatus.cancelled ||
    status === JobStatus.dead_letter
  );
}

export class JobWorkerOwnershipError extends Error {
  readonly jobId: string;
  readonly expectedWorkerId: string | null;
  readonly actualWorkerId: string;
  readonly expectedGeneration?: number;
  readonly actualGeneration?: number;

  constructor(input: {
    jobId: string;
    expectedWorkerId: string | null;
    actualWorkerId: string;
    expectedGeneration?: number;
    actualGeneration?: number;
  }) {
    super(
      `Worker ownership mismatch for job ${input.jobId}: expected ${input.expectedWorkerId ?? "none"}, received ${input.actualWorkerId}`,
    );
    this.name = "JobWorkerOwnershipError";
    this.jobId = input.jobId;
    this.expectedWorkerId = input.expectedWorkerId;
    this.actualWorkerId = input.actualWorkerId;
    this.expectedGeneration = input.expectedGeneration;
    this.actualGeneration = input.actualGeneration;
  }
}

export type EnqueueJobInput = {
  storeId: string;
  jobType: JobType;
  idempotencyKey: string;
  maxAttempts: number;
  priority?: JobPriority;
  payload?: Prisma.InputJsonValue;
  availableAt?: Date;
};

export type ClaimNextJobInput = {
  workerId: string;
  lockDurationMs?: number;
};

export type JobClaimResult = {
  job: SyncJob;
  workerId: string;
  claimedAt: Date;
  workerGeneration: number;
};

export type HeartbeatJobInput = {
  jobId: string;
  storeId: string;
  workerId?: string;
  workerGeneration?: number;
  progressPercent?: number;
  progressLabel?: string;
  lockDurationMs?: number;
};

export type ExtendJobLockInput = {
  jobId: string;
  storeId: string;
  workerId: string;
  workerGeneration?: number;
  lockDurationMs?: number;
};

export type CompleteJobInput = {
  jobId: string;
  storeId: string;
  workerId?: string;
  workerGeneration?: number;
  durationMs?: number;
};

export type FailJobInput = {
  jobId: string;
  storeId: string;
  workerId?: string;
  workerGeneration?: number;
  errorCode?: string;
  errorMessage?: string;
  retryDelayMs?: number;
};

export type CancelJobInput = {
  jobId: string;
  storeId: string;
  workerId?: string;
  reason?: string;
};

type ClaimedSyncJobRow = {
  id: string;
  storeId: string;
  jobType: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: Prisma.JsonValue;
  cursorJson: Prisma.JsonValue | null;
  progressJson: Prisma.JsonValue | null;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  deadLetterAt: Date | null;
  cancelledAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  idempotencyKey: string;
  lockedBy: string | null;
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
  heartbeatAt: Date | null;
  workerGeneration: number;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function logJob(level: LogLevel, message: string, context: JobLogContext): void {
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function computeRetryAvailableAt(attempts: number, retryDelayMs?: number): Date {
  const baseDelayMs = retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const exponentialDelayMs = baseDelayMs * 2 ** Math.max(attempts - 1, 0);
  const cappedDelayMs = Math.min(exponentialDelayMs, MAX_RETRY_DELAY_MS);
  const jitterMs = Math.floor(Math.random() * DEFAULT_RETRY_JITTER_MS);
  return new Date(Date.now() + cappedDelayMs + jitterMs);
}

function buildProgressJson(input: {
  progressPercent?: number;
  progressLabel?: string;
}): Prisma.InputJsonValue | undefined {
  if (input.progressPercent === undefined && input.progressLabel === undefined) {
    return undefined;
  }

  return {
    ...(input.progressPercent !== undefined
      ? { percent: input.progressPercent }
      : {}),
    ...(input.progressLabel !== undefined ? { label: input.progressLabel } : {}),
  };
}

async function createJobEvent(
  tx: Prisma.TransactionClient,
  input: {
    storeId: string;
    jobId: string;
    eventType: JobEventType;
    fromStatus?: JobStatus;
    toStatus?: JobStatus;
    attemptNumber?: number;
    message?: string;
    metadataJson?: Prisma.InputJsonValue;
    actorType?: JobEventActor;
    actorId?: string;
  },
): Promise<void> {
  await tx.jobEvent.create({
    data: {
      storeId: input.storeId,
      jobId: input.jobId,
      eventType: input.eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      attemptNumber: input.attemptNumber,
      message: input.message,
      metadataJson: input.metadataJson,
      actorType: input.actorType ?? JobEventActor.system,
      actorId: input.actorId,
    },
  });
}

function mapClaimedRow(row: ClaimedSyncJobRow): SyncJob {
  return row as SyncJob;
}

function assertWorkerOwnership(
  job: SyncJob,
  workerId?: string,
  workerGeneration?: number,
): void {
  if (workerId !== undefined && job.lockedBy !== workerId) {
    throw new JobWorkerOwnershipError({
      jobId: job.id,
      expectedWorkerId: job.lockedBy,
      actualWorkerId: workerId,
      expectedGeneration: workerGeneration,
      actualGeneration: job.workerGeneration,
    });
  }

  if (
    workerGeneration !== undefined &&
    job.workerGeneration !== workerGeneration
  ) {
    throw new JobWorkerOwnershipError({
      jobId: job.id,
      expectedWorkerId: job.lockedBy,
      actualWorkerId: workerId ?? "unknown",
      expectedGeneration: workerGeneration,
      actualGeneration: job.workerGeneration,
    });
  }
}

export function computeLockExpiresAt(
  from: Date,
  lockDurationMs: number = DEFAULT_LOCK_DURATION_MS,
): Date {
  return new Date(from.getTime() + lockDurationMs);
}

export function computeHeartbeatStaleCutoff(
  lockDurationMs: number = DEFAULT_LOCK_DURATION_MS,
  referenceDate: Date = new Date(),
): Date {
  return new Date(
    referenceDate.getTime() -
      STALE_HEARTBEAT_GRACE_MULTIPLIER * lockDurationMs,
  );
}

/** True when a locked job's visibility timeout expired and heartbeat is too old to trust. */
export function isJobEligibleForStaleRelease(
  job: Pick<SyncJob, "status" | "lockExpiresAt" | "heartbeatAt">,
  lockDurationMs: number = DEFAULT_LOCK_DURATION_MS,
  referenceDate: Date = new Date(),
): boolean {
  if (
    job.status !== JobStatus.running &&
    job.status !== JobStatus.claimed
  ) {
    return false;
  }

  if (!job.lockExpiresAt) {
    return false;
  }

  if (job.lockExpiresAt >= referenceDate) {
    return false;
  }

  if (!job.heartbeatAt) {
    return true;
  }

  return job.heartbeatAt <= computeHeartbeatStaleCutoff(lockDurationMs, referenceDate);
}

export async function enqueueJobWithClient(
  client: Prisma.TransactionClient,
  input: EnqueueJobInput,
): Promise<SyncJob> {
  const existing = await client.syncJob.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existing) {
    return existing;
  }

  try {
    const created = await client.syncJob.create({
      data: {
        storeId: input.storeId,
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
        maxAttempts: input.maxAttempts,
        priority: input.priority ?? JobPriority.normal,
        payload: input.payload ?? {},
        availableAt: input.availableAt ?? new Date(),
      },
    });

    await createJobEvent(client, {
      storeId: created.storeId,
      jobId: created.id,
      eventType: JobEventType.progress,
      toStatus: JobStatus.queued,
      message: "Job created",
      metadataJson: { eventKind: "created" },
    });

    return created;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const duplicate = await client.syncJob.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });

      if (duplicate) {
        return duplicate;
      }
    }

    throw error;
  }
}

export async function findExpiredLockedJobs(): Promise<SyncJob[]> {
  return prisma.syncJob.findMany({
    where: {
      status: {
        in: [JobStatus.running, JobStatus.claimed],
      },
      lockExpiresAt: {
        lt: new Date(),
      },
    },
    orderBy: {
      lockExpiresAt: "asc",
    },
  });
}

/** @deprecated Use findExpiredLockedJobs */
export async function findExpiredRunningJobs(): Promise<SyncJob[]> {
  return findExpiredLockedJobs();
}

export async function releaseStaleJobs(
  lockDurationMs: number = resolveLockDurationMs(),
): Promise<SyncJob[]> {
  const staleJobs = await findExpiredLockedJobs();
  const releasedJobs: SyncJob[] = [];
  const now = new Date();

  for (const staleJob of staleJobs) {
    const job = await prisma.$transaction(async (tx) => {
      const current = await tx.syncJob.findUnique({
        where: { id: staleJob.id },
      });

      if (!current || !isJobEligibleForStaleRelease(current, lockDurationMs, now)) {
        return null;
      }

      const availableAt = new Date();
      const requeueStatus =
        current.attempts > 0 ? JobStatus.retrying : JobStatus.queued;
      const updated = await tx.syncJob.update({
        where: { id: current.id },
        data: {
          status: requeueStatus,
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
          heartbeatAt: null,
          availableAt,
          workerGeneration: {
            increment: 1,
          },
        },
      });

      await createJobEvent(tx, {
        storeId: updated.storeId,
        jobId: updated.id,
        eventType: JobEventType.retried,
        fromStatus: current.status,
        toStatus: requeueStatus,
        attemptNumber: updated.attempts,
        message: "Stale lock released",
        metadataJson: {
          reason: "stale_lock",
          availableAt: availableAt.toISOString(),
        },
        actorType: JobEventActor.system,
      });

      return updated;
    });

    if (!job) {
      continue;
    }

    releasedJobs.push(job);
    logJob("warn", "Stale running job released back to queue", {
      storeId: job.storeId,
      jobId: job.id,
      jobType: job.jobType,
      operation: "stale_job_released",
    });
  }

  return releasedJobs;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<SyncJob> {
  const existing = await prisma.syncJob.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existing) {
    logJob("info", "Existing job returned for idempotency key", {
      storeId: existing.storeId,
      jobId: existing.id,
      jobType: existing.jobType,
      operation: "job_enqueued",
      duplicate: true,
    });
    return existing;
  }

  try {
    const job = await prisma.$transaction(async (tx) =>
      enqueueJobWithClient(tx, input),
    );

    logJob("info", "Job enqueued", {
      storeId: job.storeId,
      jobId: job.id,
      jobType: job.jobType,
      operation: "job_enqueued",
    });

    return job;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const duplicate = await prisma.syncJob.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });

      if (duplicate) {
        logJob("info", "Existing job returned after idempotency race", {
          storeId: duplicate.storeId,
          jobId: duplicate.id,
          jobType: duplicate.jobType,
          operation: "job_enqueued",
          duplicate: true,
        });
        return duplicate;
      }
    }

    throw error;
  }
}

export async function claimNextJob(
  input: ClaimNextJobInput,
): Promise<JobClaimResult | null> {
  const lockDurationMs = input.lockDurationMs ?? resolveLockDurationMs();
  const claimedAt = new Date();
  const lockExpiresAt = new Date(claimedAt.getTime() + lockDurationMs);

  const rows = await prisma.$queryRaw<ClaimedSyncJobRow[]>`
    WITH next_job AS (
      SELECT id
      FROM sync_jobs
      WHERE status IN ('queued'::"JobStatus", 'retrying'::"JobStatus")
        AND "availableAt" <= NOW()
      ORDER BY
        CASE priority
          WHEN 'critical'::"JobPriority" THEN 1
          WHEN 'high'::"JobPriority" THEN 2
          WHEN 'normal'::"JobPriority" THEN 3
          WHEN 'low'::"JobPriority" THEN 4
          ELSE 5
        END ASC,
        "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE sync_jobs AS jobs
    SET
      status = 'claimed'::"JobStatus",
      "lockedAt" = ${claimedAt},
      "lockedBy" = ${input.workerId},
      "lockExpiresAt" = ${lockExpiresAt},
      "heartbeatAt" = ${claimedAt},
      "workerGeneration" = COALESCE(jobs."workerGeneration", 0) + 1,
      attempts = jobs.attempts + 1,
      "updatedAt" = NOW()
    FROM next_job
    WHERE jobs.id = next_job.id
    RETURNING jobs.*;
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  const job = mapClaimedRow(row);

  await prisma.$transaction(async (tx) => {
    await createJobEvent(tx, {
      storeId: job.storeId,
      jobId: job.id,
      eventType: JobEventType.claimed,
      fromStatus:
        job.attempts > 1 ? JobStatus.retrying : JobStatus.queued,
      toStatus: JobStatus.claimed,
      attemptNumber: job.attempts,
      actorType: JobEventActor.worker,
      actorId: input.workerId,
    });
  });

  logJob("info", "Job claimed", {
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    workerId: input.workerId,
    operation: "job_claimed",
  });

  return {
    job,
    workerId: input.workerId,
    claimedAt,
    workerGeneration: job.workerGeneration,
  };
}

export async function beginJobExecution(input: {
  jobId: string;
  storeId: string;
  workerId: string;
  workerGeneration?: number;
  lockDurationMs?: number;
}): Promise<SyncJob> {
  const lockDurationMs = input.lockDurationMs ?? resolveLockDurationMs();
  const now = new Date();
  const lockExpiresAt = computeLockExpiresAt(now, lockDurationMs);

  const job = await prisma.$transaction(async (tx) => {
    const existing = await tx.syncJob.findUnique({
      where: {
        id: input.jobId,
        storeId: input.storeId,
      },
    });

    if (!existing) {
      throw new Error(`Job not found: ${input.jobId}`);
    }

    assertWorkerOwnership(
      existing,
      input.workerId,
      input.workerGeneration,
    );

    if (
      existing.status !== JobStatus.claimed &&
      existing.status !== JobStatus.running
    ) {
      throw new JobWorkerOwnershipError({
        jobId: existing.id,
        expectedWorkerId: existing.lockedBy,
        actualWorkerId: input.workerId,
        expectedGeneration: input.workerGeneration,
        actualGeneration: existing.workerGeneration,
      });
    }

    const updated = await tx.syncJob.update({
      where: {
        id: input.jobId,
        storeId: input.storeId,
      },
      data: {
        status: JobStatus.running,
        startedAt: existing.startedAt ?? now,
        heartbeatAt: now,
        lockExpiresAt,
      },
    });

    await createJobEvent(tx, {
      storeId: updated.storeId,
      jobId: updated.id,
      eventType: JobEventType.progress,
      fromStatus: JobStatus.claimed,
      toStatus: JobStatus.running,
      attemptNumber: updated.attempts,
      message: "Job execution started",
      actorType: JobEventActor.worker,
      actorId: input.workerId,
    });

    return updated;
  });

  return job;
}

export async function heartbeatJob(input: HeartbeatJobInput): Promise<SyncJob> {
  const heartbeatAt = new Date();
  const lockDurationMs = input.lockDurationMs ?? DEFAULT_LOCK_DURATION_MS;
  const lockExpiresAt = computeLockExpiresAt(heartbeatAt, lockDurationMs);
  const progressJson = buildProgressJson(input);

  const job = await prisma.$transaction(async (tx) => {
    const existing = await tx.syncJob.findUnique({
      where: {
        id: input.jobId,
        storeId: input.storeId,
      },
    });

    if (!existing) {
      throw new Error(`Job not found: ${input.jobId}`);
    }

    assertWorkerOwnership(existing, input.workerId);

    const updated = await tx.syncJob.update({
      where: {
        id: input.jobId,
        storeId: input.storeId,
      },
      data: {
        heartbeatAt,
        lockExpiresAt,
        ...(progressJson !== undefined ? { progressJson } : {}),
      },
    });

    await createJobEvent(tx, {
      storeId: updated.storeId,
      jobId: updated.id,
      eventType: JobEventType.progress,
      fromStatus: updated.status,
      toStatus: updated.status,
      attemptNumber: updated.attempts,
      message: "Job heartbeat",
      metadataJson: {
        eventKind: "heartbeat",
        lockExpiresAt: lockExpiresAt.toISOString(),
      },
      actorType: JobEventActor.worker,
      actorId: input.workerId,
    });

    return updated;
  });

  logJob("info", "Job heartbeat recorded", {
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    workerId: input.workerId,
    operation: "job_heartbeat",
  });

  return job;
}

export async function cancelStoreJobsOnUninstall(storeId: string): Promise<number> {
  const now = new Date();

  const count = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.syncJob.updateMany({
      where: {
        storeId,
        status: {
          in: [
            JobStatus.queued,
            JobStatus.claimed,
            JobStatus.running,
            JobStatus.retrying,
          ],
        },
      },
      data: {
        status: JobStatus.cancelled,
        cancelledAt: now,
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        heartbeatAt: null,
        workerGeneration: {
          increment: 1,
        },
      },
    });

    await tx.storeOnboarding.updateMany({
      where: { storeId },
      data: {
        currentJobId: null,
        productSyncJobId: null,
        inventorySyncJobId: null,
        ordersSyncJobId: null,
        productSyncStatus: OnboardingPhaseStatus.not_started,
        inventorySyncStatus: OnboardingPhaseStatus.not_started,
        ordersSyncStatus: OnboardingPhaseStatus.not_started,
        status: OnboardingStatus.not_started,
        failedAt: null,
        lastErrorMessage: null,
        lastErrorCode: null,
        ownershipRepairPending: false,
      },
    });

    return cancelled.count;
  });

  logJob("info", "Store jobs cancelled on uninstall", {
    storeId,
    operation: "store_jobs_cancelled",
    reason: String(count),
  });

  return count;
}

export type JobQueueMetrics = {
  queued: number;
  claimed: number;
  running: number;
  deadLetter: number;
  retrying: number;
  failed: number;
  cancelled: number;
};

export async function countRecentCancelledBootstrapJobs(
  windowMinutes = 60,
): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60_000);

  return prisma.syncJob.count({
    where: {
      status: JobStatus.cancelled,
      jobType: {
        in: [
          JobType.bootstrap_products,
          JobType.bootstrap_inventory,
          JobType.orders_historical,
        ],
      },
      cancelledAt: {
        gte: since,
      },
    },
  });
}

export async function getJobQueueMetrics(): Promise<JobQueueMetrics> {
  const rows = await prisma.$queryRaw<
    Array<{ status: JobStatus; count: bigint }>
  >`
    SELECT status, COUNT(*)::bigint AS count
    FROM sync_jobs
    GROUP BY status
  `;

  const counts = new Map<JobStatus, number>();
  for (const row of rows) {
    counts.set(row.status, Number(row.count));
  }

  return {
    queued: counts.get(JobStatus.queued) ?? 0,
    claimed: counts.get(JobStatus.claimed) ?? 0,
    running: counts.get(JobStatus.running) ?? 0,
    deadLetter: counts.get(JobStatus.dead_letter) ?? 0,
    retrying: counts.get(JobStatus.retrying) ?? 0,
    failed: counts.get(JobStatus.failed) ?? 0,
    cancelled: counts.get(JobStatus.cancelled) ?? 0,
  };
}

export type OrphanJobSummary = {
  jobId: string;
  storeId: string;
  jobType: JobType;
  status: JobStatus;
  lockedBy: string | null;
  lockExpiresAt: string | null;
  reason: "worker_offline" | "lock_expired";
};

export async function detectOrphanJobs(input?: {
  activeWorkerIds?: Set<string>;
  lockDurationMs?: number;
}): Promise<OrphanJobSummary[]> {
  const now = new Date();

  const lockedJobs = await prisma.syncJob.findMany({
    where: {
      status: { in: [JobStatus.claimed, JobStatus.running] },
      lockedBy: { not: null },
    },
    select: {
      id: true,
      storeId: true,
      jobType: true,
      status: true,
      lockedBy: true,
      lockExpiresAt: true,
      heartbeatAt: true,
    },
  });

  const orphans: OrphanJobSummary[] = [];

  for (const job of lockedJobs) {
    const lockExpired =
      job.lockExpiresAt !== null && job.lockExpiresAt < now;
    const workerOffline =
      input?.activeWorkerIds !== undefined &&
      job.lockedBy !== null &&
      !input.activeWorkerIds.has(job.lockedBy) &&
      !isEphemeralCronWorkerId(job.lockedBy);

    if (lockExpired || workerOffline) {
      orphans.push({
        jobId: job.id,
        storeId: job.storeId,
        jobType: job.jobType,
        status: job.status,
        lockedBy: job.lockedBy,
        lockExpiresAt: job.lockExpiresAt?.toISOString() ?? null,
        reason: workerOffline ? "worker_offline" : "lock_expired",
      });
    }
  }

  return orphans;
}

export async function recoverOrphanJobs(input?: {
  activeWorkerIds?: Set<string>;
  lockDurationMs?: number;
}): Promise<SyncJob[]> {
  const orphans = await detectOrphanJobs(input);
  if (orphans.length === 0) {
    return [];
  }

  return releaseStaleJobs(input?.lockDurationMs ?? resolveLockDurationMs());
}

export async function requeueDeadLetterJob(jobId: string): Promise<SyncJob | null> {
  const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== JobStatus.dead_letter) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.syncJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.queued,
        availableAt: new Date(),
        deadLetterAt: null,
        errorMessage: null,
        errorCode: null,
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        heartbeatAt: null,
        workerGeneration: { increment: 1 },
      },
    });

    await createJobEvent(tx, {
      jobId,
      storeId: job.storeId,
      eventType: JobEventType.retried,
      fromStatus: JobStatus.dead_letter,
      toStatus: JobStatus.queued,
      message: "Dead-letter job manually requeued",
    });

    return updated;
  });
}

export async function enqueueConnectorSyncJob(input: {
  storeId: string;
  connectorIds?: string[];
  forceRefresh?: boolean;
}): Promise<SyncJob> {
  const suffix = input.connectorIds?.join("-") ?? "all";
  return enqueueJob({
    storeId: input.storeId,
    jobType: JobType.connector_sync,
    idempotencyKey: `connector-sync:${input.storeId}:${suffix}:${input.forceRefresh ? "force" : "normal"}`,
    maxAttempts: 5,
    priority: JobPriority.normal,
    payload: {
      connectorIds: input.connectorIds ?? null,
      forceRefresh: input.forceRefresh ?? false,
    },
  });
}

export async function extendJobLock(input: ExtendJobLockInput): Promise<SyncJob> {
  return heartbeatJob({
    jobId: input.jobId,
    storeId: input.storeId,
    workerId: input.workerId,
    lockDurationMs: input.lockDurationMs,
  });
}

export async function completeJobWithClient(
  tx: Prisma.TransactionClient,
  input: CompleteJobInput,
): Promise<SyncJob> {
  const completedAt = new Date();
  const existing = await tx.syncJob.findUnique({
    where: {
      id: input.jobId,
      storeId: input.storeId,
    },
  });

  if (!existing) {
    throw new Error(`Job not found: ${input.jobId}`);
  }

  assertWorkerOwnership(existing, input.workerId, input.workerGeneration);

  const updated = await tx.syncJob.update({
    where: {
      id: input.jobId,
      storeId: input.storeId,
    },
    data: {
      status: JobStatus.completed,
      completedAt,
      progressJson: { percent: 100 },
      durationMs: input.durationMs,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      heartbeatAt: null,
    },
  });

  await createJobEvent(tx, {
    storeId: updated.storeId,
    jobId: updated.id,
    eventType: JobEventType.completed,
    fromStatus: existing.status,
    toStatus: JobStatus.completed,
    attemptNumber: updated.attempts,
    actorType: JobEventActor.worker,
    actorId: input.workerId,
  });

  return updated;
}

export async function completeJob(input: CompleteJobInput): Promise<SyncJob> {
  const job = await prisma.$transaction(async (tx) =>
    completeJobWithClient(tx, input),
  );

  logJob("info", "Job completed", {
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    workerId: input.workerId,
    operation: "job_completed",
  });

  return job;
}

export async function failJobWithClient(
  tx: Prisma.TransactionClient,
  input: FailJobInput,
): Promise<SyncJob> {
  const failedAt = new Date();

  const existing = await tx.syncJob.findUnique({
    where: {
      id: input.jobId,
      storeId: input.storeId,
    },
  });

  if (!existing) {
    throw new Error(`Job not found: ${input.jobId}`);
  }

  assertWorkerOwnership(existing, input.workerId, input.workerGeneration);

  const shouldRetry = existing.attempts < existing.maxAttempts;

  const updated = await tx.syncJob.update({
    where: {
      id: input.jobId,
      storeId: input.storeId,
    },
    data: shouldRetry
      ? {
          status: JobStatus.retrying,
          availableAt: computeRetryAvailableAt(
            existing.attempts,
            input.retryDelayMs,
          ),
          failedAt,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          heartbeatAt: null,
        }
      : {
          status: JobStatus.dead_letter,
          failedAt,
          deadLetterAt: failedAt,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          heartbeatAt: null,
        },
  });

  await createJobEvent(tx, {
    storeId: updated.storeId,
    jobId: updated.id,
    eventType: JobEventType.failed,
    fromStatus: existing.status,
    toStatus: shouldRetry ? JobStatus.failed : JobStatus.dead_letter,
    attemptNumber: existing.attempts,
    message: input.errorMessage,
    metadataJson: input.errorCode ? { errorCode: input.errorCode } : undefined,
    actorType: JobEventActor.worker,
    actorId: input.workerId,
  });

  if (shouldRetry) {
    await createJobEvent(tx, {
      storeId: updated.storeId,
      jobId: updated.id,
      eventType: JobEventType.retried,
      fromStatus: JobStatus.failed,
      toStatus: JobStatus.retrying,
      attemptNumber: existing.attempts,
      message: input.errorMessage,
      metadataJson: {
        availableAt: updated.availableAt.toISOString(),
      },
      actorType: JobEventActor.system,
    });
  } else {
    await createJobEvent(tx, {
      storeId: updated.storeId,
      jobId: updated.id,
      eventType: JobEventType.dead_lettered,
      fromStatus: existing.status,
      toStatus: JobStatus.dead_letter,
      attemptNumber: existing.attempts,
      message: input.errorMessage,
      metadataJson: input.errorCode ? { errorCode: input.errorCode } : undefined,
      actorType: JobEventActor.system,
    });
  }

  return updated;
}

export async function failJob(input: FailJobInput): Promise<SyncJob> {
  const job = await prisma.$transaction(async (tx) =>
    failJobWithClient(tx, input),
  );

  logJob("info", "Job failed", {
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    workerId: input.workerId,
    operation: "job_failed",
    reason: input.errorCode,
  });

  if (job.status === JobStatus.queued) {
    logJob("warn", "Job retry scheduled", {
      storeId: job.storeId,
      jobId: job.id,
      jobType: job.jobType,
      operation: "job_retried",
      reason: input.errorCode,
    });
  } else {
    logJob("error", "Job moved to dead letter", {
      storeId: job.storeId,
      jobId: job.id,
      jobType: job.jobType,
      operation: "job_dead_lettered",
      reason: input.errorCode,
    });
  }

  return job;
}

export async function cancelJob(input: CancelJobInput): Promise<SyncJob> {
  const cancelledAt = new Date();

  const job = await prisma.$transaction(async (tx) => {
    const existing = await tx.syncJob.findUnique({
      where: {
        id: input.jobId,
        storeId: input.storeId,
      },
    });

    if (!existing) {
      throw new Error(`Job not found: ${input.jobId}`);
    }

    const updated = await tx.syncJob.update({
      where: {
        id: input.jobId,
        storeId: input.storeId,
      },
      data: {
        status: JobStatus.cancelled,
        cancelledAt,
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        heartbeatAt: null,
      },
    });

    await createJobEvent(tx, {
      storeId: updated.storeId,
      jobId: updated.id,
      eventType: JobEventType.cancelled,
      fromStatus: existing.status,
      toStatus: JobStatus.cancelled,
      attemptNumber: updated.attempts,
      message: input.reason,
      actorType: JobEventActor.worker,
      actorId: input.workerId,
    });

    return updated;
  });

  logJob("info", "Job cancelled", {
    storeId: job.storeId,
    jobId: job.id,
    jobType: job.jobType,
    workerId: input.workerId,
    operation: "job_cancelled",
    reason: input.reason,
  });

  return job;
}
