-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('onboarding_bootstrap', 'bootstrap_products', 'bootstrap_inventory', 'orders_historical', 'orders_incremental', 'metrics_recompute', 'recommendations_generate', 'executive_brief_generate', 'founder_maintenance');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'retrying', 'completed', 'failed', 'dead_letter', 'cancelled');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('critical', 'high', 'normal', 'low');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('not_started', 'queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "OnboardingPhaseStatus" AS ENUM ('not_started', 'queued', 'running', 'completed', 'failed', 'blocked', 'skipped');

-- CreateEnum
CREATE TYPE "JobEventType" AS ENUM ('claimed', 'completed', 'failed', 'retried', 'dead_lettered', 'cancelled', 'progress');

-- CreateEnum
CREATE TYPE "JobEventActor" AS ENUM ('system', 'worker', 'merchant', 'founder', 'cron');

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "jobType" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "priority" "JobPriority" NOT NULL DEFAULT 'normal',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "cursorJson" JSONB,
    "progressJson" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "availableAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "failedAt" TIMESTAMPTZ,
    "deadLetterAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "lockedBy" VARCHAR(100),
    "lockedAt" TIMESTAMPTZ,
    "lockExpiresAt" TIMESTAMPTZ,
    "heartbeatAt" TIMESTAMPTZ,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_onboarding" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'not_started',
    "onboardingRunId" UUID NOT NULL,
    "currentJobId" UUID,
    "productSyncStatus" "OnboardingPhaseStatus" NOT NULL DEFAULT 'not_started',
    "productSyncJobId" UUID,
    "productSyncCompletedAt" TIMESTAMPTZ,
    "inventorySyncStatus" "OnboardingPhaseStatus" NOT NULL DEFAULT 'not_started',
    "inventorySyncJobId" UUID,
    "inventorySyncCompletedAt" TIMESTAMPTZ,
    "ordersSyncStatus" "OnboardingPhaseStatus" NOT NULL DEFAULT 'not_started',
    "ordersSyncJobId" UUID,
    "ordersSyncCompletedAt" TIMESTAMPTZ,
    "blockedReason" VARCHAR(100),
    "blockedMessage" TEXT,
    "degradedReason" VARCHAR(100),
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "progressLabel" VARCHAR(255),
    "lastErrorCode" VARCHAR(100),
    "lastErrorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "startedAt" TIMESTAMPTZ,
    "coreCompletedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "fullCompletedAt" TIMESTAMPTZ,
    "failedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "store_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "eventType" "JobEventType" NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus",
    "attemptNumber" INTEGER,
    "message" TEXT,
    "metadataJson" JSONB,
    "actorType" "JobEventActor" NOT NULL DEFAULT 'system',
    "actorId" VARCHAR(255),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_jobs_idempotencyKey_key" ON "sync_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "sync_jobs_store_id_idx" ON "sync_jobs"("storeId");

-- CreateIndex
CREATE INDEX "sync_jobs_claim_idx" ON "sync_jobs"("status", "availableAt", "priority");

-- CreateIndex
CREATE INDEX "sync_jobs_store_type_status_idx" ON "sync_jobs"("storeId", "jobType", "status");

-- CreateIndex
CREATE INDEX "sync_jobs_dead_letter_idx" ON "sync_jobs"("status", "deadLetterAt");

-- CreateIndex
CREATE INDEX "sync_jobs_created_at_idx" ON "sync_jobs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "store_onboarding_storeId_key" ON "store_onboarding"("storeId");

-- CreateIndex
CREATE INDEX "store_onboarding_status_idx" ON "store_onboarding"("status");

-- CreateIndex
CREATE INDEX "store_onboarding_stuck_idx" ON "store_onboarding"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "store_onboarding_orders_status_idx" ON "store_onboarding"("ordersSyncStatus");

-- CreateIndex
CREATE INDEX "job_events_job_id_created_at_idx" ON "job_events"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "job_events_store_id_created_at_idx" ON "job_events"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "job_events_event_type_created_at_idx" ON "job_events"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_onboarding" ADD CONSTRAINT "store_onboarding_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_onboarding" ADD CONSTRAINT "store_onboarding_currentJobId_fkey" FOREIGN KEY ("currentJobId") REFERENCES "sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_onboarding" ADD CONSTRAINT "store_onboarding_productSyncJobId_fkey" FOREIGN KEY ("productSyncJobId") REFERENCES "sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_onboarding" ADD CONSTRAINT "store_onboarding_inventorySyncJobId_fkey" FOREIGN KEY ("inventorySyncJobId") REFERENCES "sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_onboarding" ADD CONSTRAINT "store_onboarding_ordersSyncJobId_fkey" FOREIGN KEY ("ordersSyncJobId") REFERENCES "sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- F.6.18 (moved from 20260620190000_f618_high_elimination)
ALTER TABLE "sync_jobs"
ADD COLUMN "workerGeneration" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "store_onboarding"
ADD COLUMN "ownershipRepairPending" BOOLEAN NOT NULL DEFAULT false;
