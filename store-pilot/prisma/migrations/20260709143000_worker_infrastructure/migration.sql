-- Worker infrastructure: claimed job status + worker instance registry

ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'claimed';

CREATE TYPE "WorkerInstanceStatus" AS ENUM ('active', 'draining', 'stopped');

CREATE TABLE "worker_instances" (
    "id" VARCHAR(100) NOT NULL,
    "hostname" VARCHAR(255),
    "pid" INTEGER,
    "status" "WorkerInstanceStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMPTZ,
    "jobsProcessed" INTEGER NOT NULL DEFAULT 0,
    "jobsFailed" INTEGER NOT NULL DEFAULT 0,
    "currentJobId" UUID,
    "version" VARCHAR(50),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "worker_instances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_instances_heartbeat_idx" ON "worker_instances"("status", "lastHeartbeatAt");
