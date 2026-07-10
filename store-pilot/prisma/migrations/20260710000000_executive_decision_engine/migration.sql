-- CreateEnum
CREATE TYPE "ExecutiveDecisionCategory" AS ENUM ('support', 'inventory', 'pricing', 'seo', 'collections', 'operations', 'growth', 'risk', 'bundles', 'catalog', 'automation', 'performance', 'infrastructure', 'merchant_experience');

-- CreateEnum
CREATE TYPE "ExecutiveDecisionSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "DecisionTaskStatus" AS ENUM ('pending', 'approved', 'in_progress', 'completed', 'ignored', 'deferred', 'cancelled');

-- CreateEnum
CREATE TYPE "ExecutiveSourceEngine" AS ENUM ('quick_wins', 'pattern_discovery', 'historical_intelligence', 'knowledge_graph', 'merchant_baseline', 'decision_engine');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'executive_decision_generate';
ALTER TYPE "JobType" ADD VALUE 'executive_coo_generate';

-- CreateTable
CREATE TABLE "executive_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "decisionKey" VARCHAR(120) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "category" "ExecutiveDecisionCategory" NOT NULL,
    "severity" "ExecutiveDecisionSeverity" NOT NULL DEFAULT 'medium',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "businessImpact" INTEGER NOT NULL DEFAULT 0,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "urgency" INTEGER NOT NULL DEFAULT 0,
    "estimatedRevenueImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedProfitImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedEffort" INTEGER NOT NULL DEFAULT 2,
    "estimatedTimeMinutes" INTEGER NOT NULL DEFAULT 30,
    "recommendation" VARCHAR(200) NOT NULL,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "graphNodeIds" JSONB NOT NULL DEFAULT '[]',
    "relatedProducts" JSONB NOT NULL DEFAULT '[]',
    "relatedCollections" JSONB NOT NULL DEFAULT '[]',
    "relatedVendors" JSONB NOT NULL DEFAULT '[]',
    "businessMemoryIds" JSONB NOT NULL DEFAULT '[]',
    "historicalContext" JSONB NOT NULL DEFAULT '{}',
    "sourceEngine" "ExecutiveSourceEngine" NOT NULL,
    "rankScore" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "executive_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "DecisionTaskStatus" NOT NULL DEFAULT 'pending',
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "graphNodeIds" JSONB NOT NULL DEFAULT '[]',
    "businessMemoryIds" JSONB NOT NULL DEFAULT '[]',
    "businessImpact" INTEGER NOT NULL DEFAULT 0,
    "estimatedEffort" INTEGER NOT NULL DEFAULT 2,
    "estimatedTimeMinutes" INTEGER NOT NULL DEFAULT 30,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "outcomeJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "decision_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "changeType" VARCHAR(50) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executive_briefings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "briefingDate" VARCHAR(10) NOT NULL,
    "headline" VARCHAR(500) NOT NULL,
    "briefingJson" JSONB NOT NULL,
    "contextSnapshotId" UUID,
    "generatedBy" VARCHAR(50) NOT NULL DEFAULT 'deterministic',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "executive_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_operating_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "planDate" VARCHAR(10) NOT NULL,
    "estimatedCompletionMinutes" INTEGER NOT NULL DEFAULT 0,
    "estimatedRevenueOpportunity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedProfitOpportunity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taskCount" INTEGER NOT NULL DEFAULT 0,
    "planJson" JSONB NOT NULL,
    "contextSnapshotId" UUID,
    "generatedBy" VARCHAR(50) NOT NULL DEFAULT 'deterministic',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_operating_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_readiness" (
    "storeId" UUID NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "inventoryScore" INTEGER NOT NULL DEFAULT 0,
    "pricingScore" INTEGER NOT NULL DEFAULT 0,
    "seoScore" INTEGER NOT NULL DEFAULT 0,
    "collectionsScore" INTEGER NOT NULL DEFAULT 0,
    "automationScore" INTEGER NOT NULL DEFAULT 0,
    "operationalRiskScore" INTEGER NOT NULL DEFAULT 0,
    "executionCapacityScore" INTEGER NOT NULL DEFAULT 0,
    "knowledgeConfidenceScore" INTEGER NOT NULL DEFAULT 0,
    "historicalStabilityScore" INTEGER NOT NULL DEFAULT 0,
    "predictionReadinessScore" INTEGER NOT NULL DEFAULT 0,
    "scoreJson" JSONB NOT NULL DEFAULT '{}',
    "lastComputedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "operational_readiness_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "decision_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "scoreType" VARCHAR(50) NOT NULL,
    "scoreValue" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "scoreJson" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_context_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "contextJson" JSONB NOT NULL,
    "contextHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_context_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "executive_decision_store_key_unique" ON "executive_decisions"("storeId", "decisionKey");

-- CreateIndex
CREATE INDEX "executive_decision_store_rank_idx" ON "executive_decisions"("storeId", "active", "rankScore");

-- CreateIndex
CREATE INDEX "decision_task_store_status_idx" ON "decision_tasks"("storeId", "status");

-- CreateIndex
CREATE INDEX "decision_history_store_changed_idx" ON "decision_history"("storeId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "executive_briefing_store_date_unique" ON "executive_briefings"("storeId", "briefingDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_operating_plan_store_date_unique" ON "daily_operating_plans"("storeId", "planDate");

-- CreateIndex
CREATE INDEX "decision_score_store_computed_idx" ON "decision_scores"("storeId", "computedAt");

-- CreateIndex
CREATE INDEX "business_context_snapshot_store_created_idx" ON "business_context_snapshots"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "executive_decisions" ADD CONSTRAINT "executive_decisions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_tasks" ADD CONSTRAINT "decision_tasks_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_tasks" ADD CONSTRAINT "decision_tasks_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "executive_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_history" ADD CONSTRAINT "decision_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_history" ADD CONSTRAINT "decision_history_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "executive_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_briefings" ADD CONSTRAINT "executive_briefings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_operating_plans" ADD CONSTRAINT "daily_operating_plans_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_readiness" ADD CONSTRAINT "operational_readiness_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_scores" ADD CONSTRAINT "decision_scores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_scores" ADD CONSTRAINT "decision_scores_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "executive_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_context_snapshots" ADD CONSTRAINT "business_context_snapshots_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
