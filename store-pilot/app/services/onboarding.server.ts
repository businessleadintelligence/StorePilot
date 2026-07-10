import {
  JobPriority,
  JobStatus,
  JobType,
  OnboardingPhaseStatus,
  OnboardingStatus,
  Prisma,
  type StoreOnboarding,
  type SyncJob,
} from "@prisma/client";

import prisma from "../db.server";
import {
  completeJobWithClient,
  enqueueJobWithClient,
  failJobWithClient,
  isTerminalJobStatus,
} from "./job.server";
import { scheduleOrdersIncrementalSync, ensureOrdersSchedulerActive } from "./orders-scheduler.server";

const LOG_PREFIX = "[onboarding]";
const ONBOARDING_JOB_MAX_ATTEMPTS = 5;
const DEFAULT_STUCK_MINUTES = 30;
const DEFAULT_HEARTBEAT_STALE_MINUTES = 10;
const STUCK_ONBOARDING_BATCH_SIZE = 50;

type LogLevel = "info" | "warn" | "error";

type OnboardingLogContext = {
  storeId: string;
  onboardingId?: string;
  phase?: OnboardingPhase;
  jobId?: string;
  operation:
    | "onboarding_created"
    | "onboarding_phase_started"
    | "onboarding_phase_completed"
    | "onboarding_phase_failed"
    | "onboarding_advanced"
    | "onboarding_completed"
    | "onboarding_retried"
    | "onboarding_resumed"
    | "onboarding_phase_blocked"
    | "onboarding_reconciled";
  reason?: string;
  action?: OnboardingPhaseResult["action"];
};

export type OnboardingPhase = "PRODUCTS" | "INVENTORY" | "ORDERS" | "COMPLETE";

export type StoreOnboardingSummary = {
  id: string;
  storeId: string;
  status: OnboardingStatus;
  onboardingRunId: string;
  productSyncStatus: OnboardingPhaseStatus;
  inventorySyncStatus: OnboardingPhaseStatus;
  ordersSyncStatus: OnboardingPhaseStatus;
  currentJobId: string | null;
  productSyncJobId: string | null;
  inventorySyncJobId: string | null;
  ordersSyncJobId: string | null;
  progressPercent: number;
  progressLabel: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
};

export type AdvanceOnboardingInput = {
  storeId: string;
};

export type OnboardingPhaseResult = {
  storeId: string;
  phase: OnboardingPhase | null;
  action: "enqueued" | "completed" | "noop" | "failed" | "started" | "retried" | "resumed" | "blocked" | "reconciled";
  jobId?: string;
  onboarding: StoreOnboardingSummary;
};

export type StuckOnboardingRecord = StoreOnboardingSummary & {
  currentJobStatus: string | null;
  currentJobLockExpiresAt: Date | null;
  currentJobHeartbeatAt: Date | null;
};

export class OnboardingPhaseStartError extends Error {
  constructor(storeId: string, phase: OnboardingPhase) {
    super(
      `Cannot mark ${phase} started for store ${storeId} without a linked currentJobId`,
    );
    this.name = "OnboardingPhaseStartError";
  }
}

type SyncPhase = Exclude<OnboardingPhase, "COMPLETE">;

type PhaseConfig = {
  jobType: JobType;
  idempotencySuffix: "products" | "inventory" | "orders";
  statusField:
    | "productSyncStatus"
    | "inventorySyncStatus"
    | "ordersSyncStatus";
  jobIdField:
    | "productSyncJobId"
    | "inventorySyncJobId"
    | "ordersSyncJobId";
  completedAtField:
    | "productSyncCompletedAt"
    | "inventorySyncCompletedAt"
    | "ordersSyncCompletedAt";
  progressPercent: number;
  progressLabel: string;
  queuedProgressLabel: string;
};

const PHASE_CONFIG: Record<SyncPhase, PhaseConfig> = {
  PRODUCTS: {
    jobType: JobType.bootstrap_products,
    idempotencySuffix: "products",
    statusField: "productSyncStatus",
    jobIdField: "productSyncJobId",
    completedAtField: "productSyncCompletedAt",
    progressPercent: 33,
    progressLabel: "Syncing products",
    queuedProgressLabel: "Products queued",
  },
  INVENTORY: {
    jobType: JobType.bootstrap_inventory,
    idempotencySuffix: "inventory",
    statusField: "inventorySyncStatus",
    jobIdField: "inventorySyncJobId",
    completedAtField: "inventorySyncCompletedAt",
    progressPercent: 66,
    progressLabel: "Syncing inventory",
    queuedProgressLabel: "Inventory queued",
  },
  ORDERS: {
    jobType: JobType.orders_historical,
    idempotencySuffix: "orders",
    statusField: "ordersSyncStatus",
    jobIdField: "ordersSyncJobId",
    completedAtField: "ordersSyncCompletedAt",
    progressPercent: 90,
    progressLabel: "Syncing orders",
    queuedProgressLabel: "Orders queued",
  },
};

type AdvanceExecutionResult = {
  phase: OnboardingPhase | null;
  action: OnboardingPhaseResult["action"];
  jobId?: string;
  onboarding: StoreOnboarding;
};

function logOnboarding(
  level: LogLevel,
  message: string,
  context: OnboardingLogContext,
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

function buildIdempotencyKey(
  storeId: string,
  suffix: PhaseConfig["idempotencySuffix"],
  onboardingRunId?: string,
): string {
  if (onboardingRunId) {
    return `onboarding:${storeId}:${suffix}:${onboardingRunId}`;
  }

  return `onboarding:${storeId}:${suffix}`;
}

function toSummary(onboarding: StoreOnboarding): StoreOnboardingSummary {
  return {
    id: onboarding.id,
    storeId: onboarding.storeId,
    status: onboarding.status,
    onboardingRunId: onboarding.onboardingRunId,
    productSyncStatus: onboarding.productSyncStatus,
    inventorySyncStatus: onboarding.inventorySyncStatus,
    ordersSyncStatus: onboarding.ordersSyncStatus,
    currentJobId: onboarding.currentJobId,
    productSyncJobId: onboarding.productSyncJobId,
    inventorySyncJobId: onboarding.inventorySyncJobId,
    ordersSyncJobId: onboarding.ordersSyncJobId,
    progressPercent: onboarding.progressPercent,
    progressLabel: onboarding.progressLabel,
    startedAt: onboarding.startedAt,
    completedAt: onboarding.completedAt,
    failedAt: onboarding.failedAt,
  };
}

function buildResult(
  onboarding: StoreOnboarding,
  phase: OnboardingPhase | null,
  action: OnboardingPhaseResult["action"],
  jobId?: string,
): OnboardingPhaseResult {
  return {
    storeId: onboarding.storeId,
    phase,
    action,
    jobId,
    onboarding: toSummary(onboarding),
  };
}

function isPhaseCompleted(
  onboarding: Pick<StoreOnboarding, PhaseConfig["statusField"]>,
  phase: SyncPhase,
): boolean {
  return onboarding[PHASE_CONFIG[phase].statusField] === OnboardingPhaseStatus.completed;
}

function isPhaseBlocked(
  onboarding: Pick<StoreOnboarding, PhaseConfig["statusField"]>,
  phase: SyncPhase,
): boolean {
  return onboarding[PHASE_CONFIG[phase].statusField] === OnboardingPhaseStatus.blocked;
}

function isPhaseDone(
  onboarding: Pick<StoreOnboarding, PhaseConfig["statusField"]>,
  phase: SyncPhase,
): boolean {
  return isPhaseCompleted(onboarding, phase) || isPhaseBlocked(onboarding, phase);
}

function isPhaseNotStarted(
  onboarding: StoreOnboarding,
  phase: SyncPhase,
): boolean {
  return onboarding[PHASE_CONFIG[phase].statusField] === OnboardingPhaseStatus.not_started;
}

function allPhasesCompleted(onboarding: StoreOnboarding): boolean {
  return (
    isPhaseDone(onboarding, "PRODUCTS") &&
    isPhaseDone(onboarding, "INVENTORY") &&
    isPhaseDone(onboarding, "ORDERS")
  );
}

export function computeProgressPercentFromPhases(
  onboarding: Pick<
    StoreOnboarding,
    | "productSyncStatus"
    | "inventorySyncStatus"
    | "ordersSyncStatus"
    | "status"
  >,
): number {
  if (onboarding.status === OnboardingStatus.completed) {
    return 100;
  }

  let percent = 0;

  if (isPhaseDone(onboarding, "PRODUCTS")) {
    percent = 33;
  }

  if (isPhaseDone(onboarding, "INVENTORY")) {
    percent = 66;
  }

  if (isPhaseDone(onboarding, "ORDERS")) {
    percent = 90;
  }

  return percent;
}

async function repairTerminalPhaseJob(
  tx: Prisma.TransactionClient,
  storeId: string,
  onboarding: StoreOnboarding,
  phase: SyncPhase,
): Promise<StoreOnboarding> {
  const config = PHASE_CONFIG[phase];
  const phaseStatus = onboarding[config.statusField];
  const jobId = onboarding[config.jobIdField];

  if (
    phaseStatus !== OnboardingPhaseStatus.queued &&
    phaseStatus !== OnboardingPhaseStatus.running
  ) {
    return onboarding;
  }

  if (!jobId) {
    return onboarding;
  }

  const job = await tx.syncJob.findUnique({
    where: { id: jobId },
  });

  if (!job || !isTerminalJobStatus(job.status)) {
    return onboarding;
  }

  if (job.status === JobStatus.completed) {
    return markPhaseCompletedWithClient(tx, storeId, phase);
  }

  if (job.status === JobStatus.cancelled) {
    return tx.storeOnboarding.update({
      where: { storeId },
      data: {
        onboardingRunId: crypto.randomUUID(),
        status: OnboardingStatus.running,
        [config.statusField]: OnboardingPhaseStatus.not_started,
        [config.jobIdField]: null,
        currentJobId: null,
        progressPercent: computeProgressPercentFromPhases(onboarding),
        progressLabel: null,
        failedAt: null,
        lastErrorMessage: null,
        lastErrorCode: null,
      },
    });
  }

  await markPhaseFailedWithClient(
    tx,
    storeId,
    phase,
    job.errorMessage ??
      (job.status === JobStatus.dead_letter
        ? "job_dead_lettered"
        : "job_failed"),
  );

  return tx.storeOnboarding.findUniqueOrThrow({
    where: { storeId },
  });
}

async function repairTerminalPhaseJobs(
  tx: Prisma.TransactionClient,
  storeId: string,
  onboarding: StoreOnboarding,
): Promise<StoreOnboarding> {
  let current = onboarding;

  for (const phase of ["PRODUCTS", "INVENTORY", "ORDERS"] as const) {
    current = await repairTerminalPhaseJob(tx, storeId, current, phase);
  }

  return current;
}

async function isPhaseJobActive(
  tx: Prisma.TransactionClient,
  onboarding: StoreOnboarding,
  phase: SyncPhase,
): Promise<boolean> {
  const config = PHASE_CONFIG[phase];
  const jobId = onboarding[config.jobIdField];

  if (!jobId) {
    return false;
  }

  const job = await tx.syncJob.findUnique({
    where: { id: jobId },
  });

  return Boolean(job && !isTerminalJobStatus(job.status));
}

const JOB_TYPE_TO_SYNC_PHASE: Partial<Record<JobType, SyncPhase>> = {
  [JobType.bootstrap_products]: "PRODUCTS",
  [JobType.bootstrap_inventory]: "INVENTORY",
  [JobType.orders_historical]: "ORDERS",
};

function selectPhaseToEnqueue(onboarding: StoreOnboarding): SyncPhase | null {
  if (isPhaseNotStarted(onboarding, "PRODUCTS")) {
    return "PRODUCTS";
  }

  if (
    isPhaseDone(onboarding, "PRODUCTS") &&
    isPhaseNotStarted(onboarding, "INVENTORY")
  ) {
    return "INVENTORY";
  }

  if (
    isPhaseDone(onboarding, "INVENTORY") &&
    isPhaseNotStarted(onboarding, "ORDERS") &&
    !isPhaseBlocked(onboarding, "ORDERS")
  ) {
    return "ORDERS";
  }

  return null;
}

function buildPhaseLinkWhere(
  storeId: string,
  phase: SyncPhase,
): Prisma.StoreOnboardingWhereInput {
  const config = PHASE_CONFIG[phase];
  const where: Prisma.StoreOnboardingWhereInput = {
    storeId,
    [config.statusField]: OnboardingPhaseStatus.not_started,
  };

  if (phase === "INVENTORY") {
    where.productSyncStatus = {
      in: [OnboardingPhaseStatus.completed, OnboardingPhaseStatus.blocked],
    };
  }

  if (phase === "ORDERS") {
    where.productSyncStatus = {
      in: [OnboardingPhaseStatus.completed, OnboardingPhaseStatus.blocked],
    };
    where.inventorySyncStatus = {
      in: [OnboardingPhaseStatus.completed, OnboardingPhaseStatus.blocked],
    };
  }

  return where;
}

function findFailedPhase(onboarding: StoreOnboarding): SyncPhase | null {
  if (onboarding.productSyncStatus === OnboardingPhaseStatus.failed) {
    return "PRODUCTS";
  }

  if (onboarding.inventorySyncStatus === OnboardingPhaseStatus.failed) {
    return "INVENTORY";
  }

  if (onboarding.ordersSyncStatus === OnboardingPhaseStatus.failed) {
    return "ORDERS";
  }

  return null;
}

async function ensureStoreOnboarding(
  tx: Prisma.TransactionClient,
  storeId: string,
): Promise<{ onboarding: StoreOnboarding; created: boolean }> {
  const existing = await tx.storeOnboarding.findUnique({
    where: { storeId },
  });

  if (existing) {
    return { onboarding: existing, created: false };
  }

  const created = await tx.storeOnboarding.create({
    data: {
      storeId,
      onboardingRunId: crypto.randomUUID(),
      status: OnboardingStatus.not_started,
      productSyncStatus: OnboardingPhaseStatus.not_started,
      inventorySyncStatus: OnboardingPhaseStatus.not_started,
      ordersSyncStatus: OnboardingPhaseStatus.not_started,
    },
  });

  return { onboarding: created, created: true };
}

async function markPhaseCompletedWithClient(
  tx: Prisma.TransactionClient,
  storeId: string,
  phase: SyncPhase,
): Promise<StoreOnboarding> {
  const config = PHASE_CONFIG[phase];
  const now = new Date();

  return tx.storeOnboarding.update({
    where: { storeId },
    data: {
      [config.statusField]: OnboardingPhaseStatus.completed,
      [config.completedAtField]: now,
      currentJobId: null,
      progressPercent: config.progressPercent,
      progressLabel: `${config.progressLabel} complete`,
    },
  });
}

async function markPhaseBlockedWithClient(
  tx: Prisma.TransactionClient,
  storeId: string,
  phase: SyncPhase,
  blockedReason: string,
  blockedMessage: string,
): Promise<StoreOnboarding> {
  const config = PHASE_CONFIG[phase];
  const truncatedReason = blockedReason.slice(0, 100);

  return tx.storeOnboarding.update({
    where: { storeId },
    data: {
      [config.statusField]: OnboardingPhaseStatus.blocked,
      currentJobId: null,
      blockedReason: truncatedReason,
      blockedMessage,
      progressLabel: `${config.progressLabel} blocked`,
    },
  });
}

export async function finalizeSuccessfulJobPhase(input: {
  jobId: string;
  storeId: string;
  workerId: string;
  workerGeneration?: number;
  phase: SyncPhase;
  durationMs?: number;
}): Promise<OnboardingPhaseResult> {
  const execution = await prisma.$transaction(async (tx) => {
    await ensureStoreOnboarding(tx, input.storeId);

    await completeJobWithClient(tx, {
      jobId: input.jobId,
      storeId: input.storeId,
      workerId: input.workerId,
      workerGeneration: input.workerGeneration,
      durationMs: input.durationMs,
    });

    await markPhaseCompletedWithClient(tx, input.storeId, input.phase);
    return executeAdvanceOnboarding(tx, input.storeId);
  });

  logOnboarding("info", "Onboarding phase completed via atomic finalize", {
    storeId: input.storeId,
    phase: input.phase,
    jobId: input.jobId,
    operation: "onboarding_phase_completed",
    action: execution.action,
  });

  if (execution.action === "completed") {
    logOnboarding("info", "Store onboarding completed", {
      storeId: input.storeId,
      onboardingId: execution.onboarding.id,
      phase: "COMPLETE",
      operation: "onboarding_completed",
      action: "completed",
    });

    await scheduleOrdersIncrementalSync(input.storeId);
    await ensureOrdersSchedulerActive(input.storeId);
  }

  return buildResult(
    execution.onboarding,
    execution.phase,
    execution.action,
    execution.jobId,
  );
}

export async function finalizeBlockedJobPhase(input: {
  jobId: string;
  storeId: string;
  workerId: string;
  phase: SyncPhase;
  blockedReason: string;
  blockedMessage: string;
  durationMs?: number;
}): Promise<OnboardingPhaseResult> {
  const execution = await prisma.$transaction(async (tx) => {
    await ensureStoreOnboarding(tx, input.storeId);

    await completeJobWithClient(tx, {
      jobId: input.jobId,
      storeId: input.storeId,
      workerId: input.workerId,
      durationMs: input.durationMs,
    });

    await markPhaseBlockedWithClient(
      tx,
      input.storeId,
      input.phase,
      input.blockedReason,
      input.blockedMessage,
    );

    return executeAdvanceOnboarding(tx, input.storeId);
  });

  logOnboarding("warn", "Onboarding phase blocked due to permanent access failure", {
    storeId: input.storeId,
    phase: input.phase,
    jobId: input.jobId,
    operation: "onboarding_phase_blocked",
    reason: input.blockedReason,
    action: "blocked",
  });

  if (execution.action === "completed") {
    logOnboarding("info", "Store onboarding completed with blocked orders phase", {
      storeId: input.storeId,
      onboardingId: execution.onboarding.id,
      phase: "COMPLETE",
      operation: "onboarding_completed",
      action: "completed",
    });
  }

  return buildResult(
    execution.onboarding,
    execution.phase,
    execution.action === "completed" ? "completed" : "blocked",
    execution.jobId,
  );
}

const RECONCILE_ONBOARDING_BATCH_SIZE = 50;

export async function reconcileOnboardingWithCompletedJobs(): Promise<number> {
  const rows = await prisma.storeOnboarding.findMany({
    where: {
      status: {
        notIn: [OnboardingStatus.completed, OnboardingStatus.failed],
      },
      currentJobId: {
        not: null,
      },
    },
    include: {
      currentJob: true,
    },
    take: RECONCILE_ONBOARDING_BATCH_SIZE,
    orderBy: { updatedAt: "asc" },
  });

  let repaired = 0;

  for (const row of rows) {
    if (!row.currentJob) {
      continue;
    }

    const phase = JOB_TYPE_TO_SYNC_PHASE[row.currentJob.jobType];
    if (!phase) {
      continue;
    }

    const config = PHASE_CONFIG[phase];
    if (row[config.statusField] !== OnboardingPhaseStatus.running &&
      row[config.statusField] !== OnboardingPhaseStatus.queued) {
      continue;
    }

    if (row.currentJob.status === JobStatus.completed) {
      await markPhaseCompleted(row.storeId, phase);
      repaired += 1;

      logOnboarding("warn", "Repaired onboarding after completed job mismatch", {
        storeId: row.storeId,
        onboardingId: row.id,
        phase,
        jobId: row.currentJobId ?? undefined,
        operation: "onboarding_reconciled",
        action: "reconciled",
      });
      continue;
    }

    if (
      row.currentJob.status === JobStatus.dead_letter ||
      row.currentJob.status === JobStatus.cancelled
    ) {
      const reason =
        row.currentJob.errorMessage ??
        (row.currentJob.status === JobStatus.cancelled
          ? "job_cancelled"
          : "job_dead_lettered");

      await markPhaseFailed(row.storeId, phase, reason);
      repaired += 1;

      logOnboarding("warn", "Repaired onboarding after terminal job mismatch", {
        storeId: row.storeId,
        onboardingId: row.id,
        phase,
        jobId: row.currentJobId ?? undefined,
        operation: "onboarding_reconciled",
        action: "failed",
        reason: row.currentJob.status,
      });
    }
  }

  return repaired;
}

async function enqueueAndLinkPhaseJob(
  tx: Prisma.TransactionClient,
  storeId: string,
  phase: SyncPhase,
  onboarding: StoreOnboarding,
  idempotencyKey: string,
): Promise<StoreOnboarding> {
  const config = PHASE_CONFIG[phase];
  let currentOnboarding = onboarding;
  let job = await enqueueJobWithClient(tx, {
    storeId,
    jobType: config.jobType,
    idempotencyKey,
    maxAttempts: ONBOARDING_JOB_MAX_ATTEMPTS,
    priority: JobPriority.critical,
    payload: {
      onboardingRunId: currentOnboarding.onboardingRunId,
      phase,
    },
  });

  if (isTerminalJobStatus(job.status)) {
    const newRunId = crypto.randomUUID();
    currentOnboarding = await tx.storeOnboarding.update({
      where: { storeId },
      data: { onboardingRunId: newRunId },
    });

    job = await enqueueJobWithClient(tx, {
      storeId,
      jobType: config.jobType,
      idempotencyKey: buildIdempotencyKey(
        storeId,
        config.idempotencySuffix,
        newRunId,
      ),
      maxAttempts: ONBOARDING_JOB_MAX_ATTEMPTS,
      priority: JobPriority.critical,
      payload: {
        onboardingRunId: currentOnboarding.onboardingRunId,
        phase,
      },
    });
  }

  const link = await tx.storeOnboarding.updateMany({
    where: buildPhaseLinkWhere(storeId, phase),
    data: {
      status: OnboardingStatus.running,
      startedAt: currentOnboarding.startedAt ?? new Date(),
      currentJobId: job.id,
      [config.jobIdField]: job.id,
      [config.statusField]: OnboardingPhaseStatus.queued,
      progressPercent: computeProgressPercentFromPhases(currentOnboarding),
      progressLabel: config.queuedProgressLabel,
    },
  });

  if (link.count === 0) {
    const current = await tx.storeOnboarding.findUniqueOrThrow({
      where: { storeId },
    });

    if (
      current[config.jobIdField] === job.id ||
      current.currentJobId === job.id
    ) {
      return current;
    }

    throw new Error(
      `Failed to link ${phase} job ${job.id} for store ${storeId}: phase gate changed during transaction`,
    );
  }

  return tx.storeOnboarding.findUniqueOrThrow({
    where: { storeId },
  });
}

async function executeAdvanceOnboarding(
  tx: Prisma.TransactionClient,
  storeId: string,
): Promise<AdvanceExecutionResult> {
  const { onboarding: initialOnboarding, created } = await ensureStoreOnboarding(
    tx,
    storeId,
  );

  if (created) {
    logOnboarding("info", "Store onboarding row created", {
      storeId,
      onboardingId: initialOnboarding.id,
      operation: "onboarding_created",
    });
  }

  let onboarding = initialOnboarding;

  onboarding = await repairTerminalPhaseJobs(tx, storeId, onboarding);

  if (onboarding.status === OnboardingStatus.failed) {
    return {
      phase: null,
      action: "failed",
      onboarding,
    };
  }

  if (onboarding.status === OnboardingStatus.completed) {
    return {
      phase: "COMPLETE",
      action: "completed",
      onboarding,
    };
  }

  if (allPhasesCompleted(onboarding)) {
    onboarding = await tx.storeOnboarding.update({
      where: { storeId },
      data: {
        status: OnboardingStatus.completed,
        completedAt: new Date(),
        currentJobId: null,
        progressPercent: 100,
        progressLabel: "Onboarding complete",
      },
    });

    return {
      phase: "COMPLETE",
      action: "completed",
      onboarding,
    };
  }

  const phaseToEnqueue = selectPhaseToEnqueue(onboarding);
  if (!phaseToEnqueue) {
    return {
      phase: null,
      action: "noop",
      onboarding,
    };
  }

  const config = PHASE_CONFIG[phaseToEnqueue];
  const phaseStatus = onboarding[config.statusField];

  if (
    (phaseStatus === OnboardingPhaseStatus.running ||
      phaseStatus === OnboardingPhaseStatus.queued) &&
    onboarding[config.jobIdField]
  ) {
    const active = await isPhaseJobActive(tx, onboarding, phaseToEnqueue);
    if (active) {
      return {
        phase: null,
        action: "noop",
        onboarding,
      };
    }
  }

  onboarding = await enqueueAndLinkPhaseJob(
    tx,
    storeId,
    phaseToEnqueue,
    onboarding,
    buildIdempotencyKey(
      storeId,
      config.idempotencySuffix,
      onboarding.onboardingRunId,
    ),
  );

  return {
    phase: phaseToEnqueue,
    action: "enqueued",
    jobId: onboarding[config.jobIdField] ?? onboarding.currentJobId ?? undefined,
    onboarding,
  };
}

/** afterAuth step 1: ensure StoreOnboarding row exists. */
export async function getOrCreateStoreOnboarding(
  storeId: string,
): Promise<StoreOnboardingSummary> {
  const result = await prisma.$transaction(async (tx) => {
    const { onboarding } = await ensureStoreOnboarding(tx, storeId);
    return onboarding;
  });

  return toSummary(result);
}

export async function getStoreOnboarding(
  storeId: string,
): Promise<StoreOnboardingSummary | null> {
  const onboarding = await prisma.storeOnboarding.findUnique({
    where: { storeId },
  });

  return onboarding ? toSummary(onboarding) : null;
}

/** afterAuth step 2: enqueue the next onboarding phase job (idempotent). */
export async function advanceOnboarding(
  input: AdvanceOnboardingInput,
): Promise<OnboardingPhaseResult> {
  const execution = await prisma.$transaction(async (tx) =>
    executeAdvanceOnboarding(tx, input.storeId),
  );

  if (execution.action === "enqueued") {
    logOnboarding("info", "Onboarding advanced to next phase job", {
      storeId: input.storeId,
      onboardingId: execution.onboarding.id,
      phase: execution.phase ?? undefined,
      jobId: execution.jobId,
      operation: "onboarding_advanced",
      action: "enqueued",
    });
  } else if (execution.action === "completed") {
    logOnboarding("info", "Store onboarding completed", {
      storeId: input.storeId,
      onboardingId: execution.onboarding.id,
      phase: "COMPLETE",
      operation: "onboarding_completed",
      action: "completed",
    });
  } else if (execution.action === "noop") {
    logOnboarding("info", "Onboarding advance noop", {
      storeId: input.storeId,
      onboardingId: execution.onboarding.id,
      operation: "onboarding_advanced",
      action: "noop",
    });
  }

  return buildResult(
    execution.onboarding,
    execution.phase,
    execution.action,
    execution.jobId,
  );
}

export async function markPhaseStarted(
  storeId: string,
  phase: OnboardingPhase,
): Promise<OnboardingPhaseResult> {
  if (phase === "COMPLETE") {
    await getOrCreateStoreOnboarding(storeId);
    const record = await prisma.storeOnboarding.findUniqueOrThrow({
      where: { storeId },
    });
    return buildResult(record, "COMPLETE", "noop");
  }

  const existing = await prisma.storeOnboarding.findUnique({
    where: { storeId },
  });

  if (!existing?.currentJobId) {
    throw new OnboardingPhaseStartError(storeId, phase);
  }

  const config = PHASE_CONFIG[phase];
  const now = new Date();

  const updated = await prisma.storeOnboarding.update({
    where: { storeId },
    data: {
      status: OnboardingStatus.running,
      startedAt: existing.startedAt ?? now,
      currentJobId: existing.currentJobId,
      [config.statusField]: OnboardingPhaseStatus.running,
      progressLabel: config.progressLabel,
    },
  });

  logOnboarding("info", "Onboarding phase started", {
    storeId,
    onboardingId: updated.id,
    phase,
    jobId: updated.currentJobId ?? undefined,
    operation: "onboarding_phase_started",
    action: "started",
  });

  return buildResult(updated, phase, "started", updated.currentJobId ?? undefined);
}

export async function markPhaseBlocked(
  storeId: string,
  phase: SyncPhase,
  blockedReason: string,
  blockedMessage: string,
): Promise<OnboardingPhaseResult> {
  await getOrCreateStoreOnboarding(storeId);

  await prisma.storeOnboarding.update({
    where: { storeId },
    data: {
      [PHASE_CONFIG[phase].statusField]: OnboardingPhaseStatus.blocked,
      currentJobId: null,
      blockedReason: blockedReason.slice(0, 100),
      blockedMessage,
      progressLabel: `${PHASE_CONFIG[phase].progressLabel} blocked`,
    },
  });

  logOnboarding("warn", "Onboarding phase blocked", {
    storeId,
    phase,
    operation: "onboarding_phase_blocked",
    reason: blockedReason,
    action: "blocked",
  });

  return advanceOnboarding({ storeId });
}

export async function markPhaseCompleted(
  storeId: string,
  phase: OnboardingPhase,
): Promise<OnboardingPhaseResult> {
  if (phase === "COMPLETE") {
    return advanceOnboarding({ storeId });
  }

  await getOrCreateStoreOnboarding(storeId);
  const config = PHASE_CONFIG[phase];
  const now = new Date();

  await prisma.storeOnboarding.update({
    where: { storeId },
    data: {
      [config.statusField]: OnboardingPhaseStatus.completed,
      [config.completedAtField]: now,
      currentJobId: null,
      progressPercent: config.progressPercent,
      progressLabel: `${config.progressLabel} complete`,
    },
  });

  logOnboarding("info", "Onboarding phase completed", {
    storeId,
    phase,
    operation: "onboarding_phase_completed",
    action: "completed",
  });

  return advanceOnboarding({ storeId });
}

export async function markPhaseFailed(
  storeId: string,
  phase: OnboardingPhase,
  reason: string,
): Promise<OnboardingPhaseResult> {
  await getOrCreateStoreOnboarding(storeId);

  const updated = await prisma.$transaction(async (tx) =>
    markPhaseFailedWithClient(tx, storeId, phase, reason),
  );

  logOnboarding("error", "Onboarding phase failed", {
    storeId,
    onboardingId: updated.id,
    ...(phase === "COMPLETE" ? {} : { phase }),
    operation: "onboarding_phase_failed",
    reason,
    action: "failed",
  });

  return buildResult(updated, phase === "COMPLETE" ? null : phase, "failed");
}

async function markPhaseFailedWithClient(
  tx: Prisma.TransactionClient,
  storeId: string,
  phase: OnboardingPhase,
  reason: string,
): Promise<StoreOnboarding> {
  const now = new Date();

  const data: Prisma.StoreOnboardingUncheckedUpdateInput = {
    status: OnboardingStatus.failed,
    failedAt: now,
    currentJobId: null,
    lastErrorMessage: reason,
  };

  if (phase !== "COMPLETE") {
    const config = PHASE_CONFIG[phase];
    data[config.statusField] = OnboardingPhaseStatus.failed;
    data[config.jobIdField] = null;
  }

  return tx.storeOnboarding.update({
    where: { storeId },
    data,
  });
}

export async function finalizeFailedOnboardingJob(input: {
  jobId: string;
  storeId: string;
  workerId: string;
  phase: Exclude<OnboardingPhase, "COMPLETE">;
  errorCode: string;
  errorMessage: string;
  retryDelayMs?: number;
}): Promise<{ job: SyncJob; markedFailed: boolean }> {
  const job = await prisma.$transaction(async (tx) => {
    const failedJob = await failJobWithClient(tx, input);

    if (failedJob.status === JobStatus.dead_letter) {
      await markPhaseFailedWithClient(
        tx,
        input.storeId,
        input.phase,
        input.errorMessage,
      );
    }

    return failedJob;
  });

  return {
    job,
    markedFailed: job.status === JobStatus.dead_letter,
  };
}

export async function retryOnboardingPhase(
  storeId: string,
  phase: SyncPhase,
): Promise<OnboardingPhaseResult> {
  const newRunId = crypto.randomUUID();
  const config = PHASE_CONFIG[phase];

  const execution = await prisma.$transaction(async (tx) => {
    const onboarding = await tx.storeOnboarding.findUnique({
      where: { storeId },
    });

    if (!onboarding) {
      throw new Error(`Store onboarding not found: ${storeId}`);
    }

    const reset = await tx.storeOnboarding.update({
      where: { storeId },
      data: {
        onboardingRunId: newRunId,
        status: OnboardingStatus.running,
        failedAt: null,
        lastErrorMessage: null,
        lastErrorCode: null,
        currentJobId: null,
        blockedReason: null,
        blockedMessage: null,
        [config.statusField]: OnboardingPhaseStatus.not_started,
        [config.jobIdField]: null,
      },
    });

    const linked = await enqueueAndLinkPhaseJob(
      tx,
      storeId,
      phase,
      reset,
      buildIdempotencyKey(storeId, config.idempotencySuffix, newRunId),
    );

    return {
      onboarding: linked,
      jobId: linked[config.jobIdField] ?? linked.currentJobId ?? undefined,
    };
  });

  logOnboarding("info", "Onboarding phase retried with fresh job", {
    storeId,
    onboardingId: execution.onboarding.id,
    phase,
    jobId: execution.jobId,
    operation: "onboarding_retried",
    action: "retried",
  });

  return buildResult(
    execution.onboarding,
    phase,
    "retried",
    execution.jobId,
  );
}

export async function resumeOnboarding(
  storeId: string,
): Promise<OnboardingPhaseResult> {
  const onboarding = await prisma.storeOnboarding.findUnique({
    where: { storeId },
  });

  if (!onboarding) {
    await getOrCreateStoreOnboarding(storeId);
    const result = await advanceOnboarding({ storeId });
    return {
      ...result,
      action: "resumed",
    };
  }

  if (onboarding.status === OnboardingStatus.failed) {
    const failedPhase = findFailedPhase(onboarding);

    if (failedPhase) {
      const result = await retryOnboardingPhase(storeId, failedPhase);
      logOnboarding("info", "Failed onboarding resumed from failed phase", {
        storeId,
        onboardingId: result.onboarding.id,
        phase: failedPhase,
        jobId: result.jobId,
        operation: "onboarding_resumed",
        action: "resumed",
      });
      return {
        ...result,
        action: "resumed",
      };
    }

    await prisma.storeOnboarding.update({
      where: { storeId },
      data: {
        status: OnboardingStatus.not_started,
        failedAt: null,
        lastErrorMessage: null,
        lastErrorCode: null,
      },
    });
  }

  const result = await advanceOnboarding({ storeId });
  logOnboarding("info", "Onboarding resumed via advance", {
    storeId,
    onboardingId: result.onboarding.id,
    operation: "onboarding_resumed",
    action: "resumed",
  });

  return {
    ...result,
    action: "resumed",
  };
}

export async function findStuckOnboarding(input?: {
  staleMinutes?: number;
  heartbeatStaleMinutes?: number;
}): Promise<StuckOnboardingRecord[]> {
  const staleMinutes = input?.staleMinutes ?? DEFAULT_STUCK_MINUTES;
  const heartbeatStaleMinutes =
    input?.heartbeatStaleMinutes ?? DEFAULT_HEARTBEAT_STALE_MINUTES;
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const heartbeatCutoff = new Date(
    Date.now() - heartbeatStaleMinutes * 60 * 1000,
  );
  const now = new Date();

  const rows = await prisma.storeOnboarding.findMany({
    where: {
      status: {
        notIn: [OnboardingStatus.completed, OnboardingStatus.failed],
      },
      OR: [
        {
          updatedAt: {
            lt: staleCutoff,
          },
        },
        {
          currentJob: {
            status: {
              in: ["completed", "dead_letter", "cancelled"],
            },
          },
        },
        {
          currentJob: {
            status: "running",
            lockExpiresAt: {
              lt: now,
            },
          },
        },
        {
          currentJob: {
            status: "running",
            heartbeatAt: {
              lt: heartbeatCutoff,
            },
          },
        },
      ],
    },
    include: {
      currentJob: {
        select: {
          id: true,
          status: true,
          lockExpiresAt: true,
          heartbeatAt: true,
          jobType: true,
          errorMessage: true,
        },
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
    take: STUCK_ONBOARDING_BATCH_SIZE,
  });

  return rows.map((row) => ({
    ...toSummary(row),
    currentJobStatus: row.currentJob?.status ?? null,
    currentJobLockExpiresAt: row.currentJob?.lockExpiresAt ?? null,
    currentJobHeartbeatAt: row.currentJob?.heartbeatAt ?? null,
  }));
}

export async function markOnboardingOwnershipRepairCandidate(
  storeId: string,
  jobId?: string,
): Promise<void> {
  await prisma.storeOnboarding.updateMany({
    where: { storeId },
    data: {
      ownershipRepairPending: true,
      currentJobId: null,
    },
  });

  logOnboarding("warn", "Onboarding marked for ownership repair", {
    storeId,
    jobId,
    operation: "onboarding_reconciled",
    action: "reconciled",
    reason: "ownership_conflict",
  });
}

export async function repairOwnershipConflictOnboarding(): Promise<number> {
  const rows = await prisma.storeOnboarding.findMany({
    where: { ownershipRepairPending: true },
  });

  let repaired = 0;

  for (const row of rows) {
    await prisma.storeOnboarding.update({
      where: { storeId: row.storeId },
      data: {
        ownershipRepairPending: false,
        currentJobId: null,
        productSyncJobId: null,
        inventorySyncJobId: null,
        ordersSyncJobId: null,
        productSyncStatus:
          row.productSyncStatus === OnboardingPhaseStatus.running
            ? OnboardingPhaseStatus.not_started
            : row.productSyncStatus,
        inventorySyncStatus:
          row.inventorySyncStatus === OnboardingPhaseStatus.running
            ? OnboardingPhaseStatus.not_started
            : row.inventorySyncStatus,
        ordersSyncStatus:
          row.ordersSyncStatus === OnboardingPhaseStatus.running
            ? OnboardingPhaseStatus.not_started
            : row.ordersSyncStatus,
        status:
          row.status === OnboardingStatus.running
            ? OnboardingStatus.queued
            : row.status,
      },
    });

    await advanceOnboarding({ storeId: row.storeId });
    repaired += 1;

    logOnboarding("warn", "Repaired onboarding after ownership conflict", {
      storeId: row.storeId,
      onboardingId: row.id,
      operation: "onboarding_reconciled",
      action: "reconciled",
      reason: "ownership_conflict",
    });
  }

  return repaired;
}
