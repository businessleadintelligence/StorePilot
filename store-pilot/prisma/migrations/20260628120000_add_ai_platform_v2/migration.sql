-- AI Platform v2 foundation

CREATE TYPE "AIAgentId" AS ENUM (
  'product_intelligence',
  'inventory_intelligence',
  'bundle_discovery',
  'executive_summary',
  'seo_audit',
  'store_audit',
  'offer_intelligence',
  'trend_intelligence',
  'platform_template'
);

CREATE TYPE "AIExecutionStatus" AS ENUM (
  'pending',
  'running',
  'retry',
  'succeeded',
  'failed',
  'cached',
  'skipped'
);

CREATE TYPE "AIValidationStatus" AS ENUM (
  'valid',
  'invalid',
  'retried',
  'failed_after_retry'
);

CREATE TYPE "AIRecommendationStatus" AS ENUM (
  'open',
  'viewed',
  'implemented',
  'dismissed',
  'verified',
  'closed'
);

CREATE TYPE "AIMemoryScope" AS ENUM (
  'recommendation',
  'merchant_action',
  'dismissal',
  'preference'
);

CREATE TABLE "ai_prompt_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "promptId" VARCHAR(100) NOT NULL,
  "version" VARCHAR(50) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "description" TEXT NOT NULL,
  "expectedSchema" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_prompt_versions_prompt_version_unique"
ON "ai_prompt_versions"("promptId", "version");

CREATE INDEX "ai_prompt_versions_prompt_created_idx"
ON "ai_prompt_versions"("promptId", "createdAt");

CREATE TABLE "ai_agent_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL,
  "merchantId" UUID,
  "agentId" "AIAgentId" NOT NULL,
  "status" "AIExecutionStatus" NOT NULL DEFAULT 'pending',
  "validationStatus" "AIValidationStatus",
  "subjectKey" VARCHAR(255) NOT NULL,
  "inputFingerprint" VARCHAR(64) NOT NULL,
  "contextJson" JSONB NOT NULL,
  "promptId" VARCHAR(100) NOT NULL,
  "promptVersion" VARCHAR(50) NOT NULL,
  "promptChecksum" VARCHAR(64) NOT NULL,
  "promptVersionId" UUID,
  "providerId" VARCHAR(50) NOT NULL,
  "modelId" VARCHAR(100) NOT NULL,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "promptTokens" INTEGER NOT NULL DEFAULT 0,
  "completionTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "errorCode" VARCHAR(100),
  "errorMessage" TEXT,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "runId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "agentId" "AIAgentId" NOT NULL,
  "subjectKey" VARCHAR(255) NOT NULL,
  "inputFingerprint" VARCHAR(64) NOT NULL,
  "resultJson" JSONB NOT NULL,
  "summary" TEXT,
  "priority" INTEGER,
  "confidence" DECIMAL(5,4),
  "isSuccess" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_execution_telemetry" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "runId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "merchantId" UUID,
  "agentId" "AIAgentId" NOT NULL,
  "providerId" VARCHAR(50) NOT NULL,
  "modelId" VARCHAR(100) NOT NULL,
  "promptId" VARCHAR(100) NOT NULL,
  "promptVersion" VARCHAR(50) NOT NULL,
  "promptChecksum" VARCHAR(64) NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "promptTokens" INTEGER NOT NULL,
  "completionTokens" INTEGER NOT NULL,
  "totalTokens" INTEGER NOT NULL,
  "estimatedCostUsd" DECIMAL(12,6) NOT NULL,
  "retryCount" INTEGER NOT NULL,
  "validationStatus" "AIValidationStatus" NOT NULL,
  "executionStatus" "AIExecutionStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_execution_telemetry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_recommendations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stableId" VARCHAR(64) NOT NULL,
  "storeId" UUID NOT NULL,
  "agentId" "AIAgentId" NOT NULL,
  "runId" UUID NOT NULL,
  "subjectKey" VARCHAR(255) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "summary" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "priority" INTEGER NOT NULL,
  "confidence" DECIMAL(5,4) NOT NULL,
  "status" "AIRecommendationStatus" NOT NULL DEFAULT 'open',
  "payloadJson" JSONB NOT NULL,
  "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "statusChangedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_memory_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL,
  "scope" "AIMemoryScope" NOT NULL,
  "subjectKey" VARCHAR(255) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "expiresAt" TIMESTAMPTZ,
  CONSTRAINT "ai_memory_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_result_cache_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL,
  "agentId" "AIAgentId" NOT NULL,
  "subjectKey" VARCHAR(255) NOT NULL,
  "inputFingerprint" VARCHAR(64) NOT NULL,
  "resultId" UUID NOT NULL,
  "validUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ai_result_cache_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_agent_results_run_id_key" ON "ai_agent_results"("runId");
CREATE UNIQUE INDEX "ai_execution_telemetry_run_id_key" ON "ai_execution_telemetry"("runId");
CREATE UNIQUE INDEX "ai_recommendations_store_stable_unique" ON "ai_recommendations"("storeId", "stableId");
CREATE UNIQUE INDEX "ai_result_cache_unique"
ON "ai_result_cache_entries"("storeId", "agentId", "subjectKey", "inputFingerprint");

CREATE INDEX "ai_agent_runs_store_agent_created_idx"
ON "ai_agent_runs"("storeId", "agentId", "createdAt");

CREATE INDEX "ai_agent_runs_store_agent_fingerprint_idx"
ON "ai_agent_runs"("storeId", "agentId", "inputFingerprint");

CREATE INDEX "ai_agent_runs_status_created_idx"
ON "ai_agent_runs"("status", "createdAt");

CREATE INDEX "ai_agent_results_cache_lookup_idx"
ON "ai_agent_results"("storeId", "agentId", "inputFingerprint", "isSuccess");

CREATE INDEX "ai_agent_results_store_agent_success_idx"
ON "ai_agent_results"("storeId", "agentId", "isSuccess", "createdAt");

CREATE INDEX "ai_execution_telemetry_store_agent_created_idx"
ON "ai_execution_telemetry"("storeId", "agentId", "createdAt");

CREATE INDEX "ai_recommendations_store_agent_status_idx"
ON "ai_recommendations"("storeId", "agentId", "status");

CREATE INDEX "ai_recommendations_store_subject_status_idx"
ON "ai_recommendations"("storeId", "subjectKey", "status");

CREATE INDEX "ai_memory_records_store_scope_subject_idx"
ON "ai_memory_records"("storeId", "scope", "subjectKey");

CREATE INDEX "ai_result_cache_store_agent_subject_idx"
ON "ai_result_cache_entries"("storeId", "agentId", "subjectKey");

ALTER TABLE "ai_agent_runs"
ADD CONSTRAINT "ai_agent_runs_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "stores"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_agent_runs"
ADD CONSTRAINT "ai_agent_runs_promptVersionId_fkey"
FOREIGN KEY ("promptVersionId") REFERENCES "ai_prompt_versions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_agent_results"
ADD CONSTRAINT "ai_agent_results_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "ai_agent_runs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_agent_results"
ADD CONSTRAINT "ai_agent_results_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "stores"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_execution_telemetry"
ADD CONSTRAINT "ai_execution_telemetry_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "ai_agent_runs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_recommendations"
ADD CONSTRAINT "ai_recommendations_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "stores"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_recommendations"
ADD CONSTRAINT "ai_recommendations_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "ai_agent_runs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_memory_records"
ADD CONSTRAINT "ai_memory_records_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "stores"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_result_cache_entries"
ADD CONSTRAINT "ai_result_cache_entries_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "stores"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_result_cache_entries"
ADD CONSTRAINT "ai_result_cache_entries_resultId_fkey"
FOREIGN KEY ("resultId") REFERENCES "ai_agent_results"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
