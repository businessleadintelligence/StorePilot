-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'experiment_generate';

-- AlterTable
ALTER TABLE "learning_readiness" ADD COLUMN "experimentReady" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "ExperimentDomain" AS ENUM ('pricing', 'seo', 'bundles', 'inventory', 'merchandising', 'collections', 'content', 'operations');
CREATE TYPE "ExperimentStatus" AS ENUM ('suggested', 'shadow_simulated', 'pending_approval', 'approved', 'running', 'completed', 'rejected', 'dismissed', 'cancelled', 'no_change', 'tie');
CREATE TYPE "ExperimentRiskLevel" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "ExperimentWinnerOutcome" AS ENUM ('winner', 'loser', 'no_change', 'statistical_tie');
CREATE TYPE "ExperimentSourceType" AS ENUM ('quick_win', 'root_cause', 'prediction', 'pattern', 'evidence');
CREATE TYPE "ExperimentEventType" AS ENUM ('ExperimentStarted', 'ExperimentCompleted', 'WinnerSelected', 'ExperimentRejected', 'ExperimentCancelled');

-- CreateTable
CREATE TABLE "experiments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentKey" VARCHAR(120) NOT NULL,
    "experimentDomain" "ExperimentDomain" NOT NULL,
    "templateKey" VARCHAR(120) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "businessProblem" VARCHAR(500) NOT NULL,
    "proposedChange" VARCHAR(500) NOT NULL,
    "expectedRevenueImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedProfitImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "estimatedDurationDays" INTEGER NOT NULL DEFAULT 14,
    "merchantEffort" INTEGER NOT NULL DEFAULT 2,
    "businessRisk" "ExperimentRiskLevel" NOT NULL DEFAULT 'medium',
    "baselineMetrics" JSONB NOT NULL DEFAULT '{}',
    "successMetrics" JSONB NOT NULL DEFAULT '{}',
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "graphNodeIds" JSONB NOT NULL DEFAULT '[]',
    "memoryIds" JSONB NOT NULL DEFAULT '[]',
    "predictionIds" JSONB NOT NULL DEFAULT '[]',
    "rootCauseIds" JSONB NOT NULL DEFAULT '[]',
    "recommendationSource" "ExperimentSourceType" NOT NULL DEFAULT 'evidence',
    "shadowSimulationJson" JSONB NOT NULL DEFAULT '{}',
    "status" "ExperimentStatus" NOT NULL DEFAULT 'shadow_simulated',
    "rankScore" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "templateKey" VARCHAR(120) NOT NULL,
    "domain" "ExperimentDomain" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "templateJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "experiment_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "opportunityKey" VARCHAR(120) NOT NULL,
    "domain" "ExperimentDomain" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "businessProblem" VARCHAR(500) NOT NULL,
    "sourceType" "ExperimentSourceType" NOT NULL,
    "sourceId" VARCHAR(120) NOT NULL DEFAULT '',
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "memoryIds" JSONB NOT NULL DEFAULT '[]',
    "predictionIds" JSONB NOT NULL DEFAULT '[]',
    "rootCauseIds" JSONB NOT NULL DEFAULT '[]',
    "estimatedImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "opportunityJson" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "experiment_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "recommendationKey" VARCHAR(120) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "expectedMonthlyGain" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "businessRisk" "ExperimentRiskLevel" NOT NULL DEFAULT 'medium',
    "estimatedDurationDays" INTEGER NOT NULL DEFAULT 14,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "experiment_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_baselines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "baselineKey" VARCHAR(120) NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conversion" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "ctr" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "inventory" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "traffic" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "seoScore" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "refunds" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "aov" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "margin" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "baselineJson" JSONB NOT NULL DEFAULT '{}',
    "capturedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_baselines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "variantKey" VARCHAR(120) NOT NULL,
    "variantLabel" VARCHAR(100) NOT NULL,
    "currentValue" VARCHAR(300) NOT NULL,
    "proposedValue" VARCHAR(300) NOT NULL,
    "variantJson" JSONB NOT NULL DEFAULT '{}',
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_observations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "observationKey" VARCHAR(120) NOT NULL,
    "variantKey" VARCHAR(120) NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "conversion" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "ctr" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "refunds" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "inventory" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "traffic" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "margin" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "observationJson" JSONB NOT NULL DEFAULT '{}',
    "observedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_observations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "resultKey" VARCHAR(120) NOT NULL,
    "variantKey" VARCHAR(120) NOT NULL,
    "metricKey" VARCHAR(100) NOT NULL,
    "baselineValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "variantValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "difference" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "differencePct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "resultJson" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_winners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "winnerKey" VARCHAR(120) NOT NULL,
    "variantKey" VARCHAR(120) NOT NULL,
    "outcome" "ExperimentWinnerOutcome" NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "revenueImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profitImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "winnerJson" JSONB NOT NULL DEFAULT '{}',
    "selectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_winners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "changeType" VARCHAR(50) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_learning" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "eventType" "ExperimentEventType" NOT NULL,
    "eventJson" JSONB NOT NULL DEFAULT '{}',
    "memoryIds" JSONB NOT NULL DEFAULT '[]',
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "emittedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_learning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_confidences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "dataCoverage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "businessStability" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "historicalSupport" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "merchantSimilarity" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "freshness" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "confidenceJson" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_confidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "experiment_store_key_unique" ON "experiments"("storeId", "experimentKey");
CREATE INDEX "experiment_store_status_rank_idx" ON "experiments"("storeId", "active", "status", "rankScore");
CREATE UNIQUE INDEX "experiment_template_store_key_unique" ON "experiment_templates"("storeId", "templateKey");
CREATE UNIQUE INDEX "experiment_opportunity_store_key_unique" ON "experiment_opportunities"("storeId", "opportunityKey");
CREATE INDEX "experiment_opportunity_store_confidence_idx" ON "experiment_opportunities"("storeId", "active", "confidence");
CREATE UNIQUE INDEX "experiment_recommendation_store_key_unique" ON "experiment_recommendations"("storeId", "recommendationKey");
CREATE INDEX "experiment_recommendation_store_active_idx" ON "experiment_recommendations"("storeId", "active");
CREATE UNIQUE INDEX "experiment_baseline_store_key_unique" ON "experiment_baselines"("storeId", "baselineKey");
CREATE UNIQUE INDEX "experiment_variant_store_key_unique" ON "experiment_variants"("storeId", "variantKey");
CREATE UNIQUE INDEX "experiment_observation_store_key_unique" ON "experiment_observations"("storeId", "observationKey");
CREATE INDEX "experiment_observation_store_experiment_idx" ON "experiment_observations"("storeId", "experimentId", "observedAt");
CREATE UNIQUE INDEX "experiment_result_store_key_unique" ON "experiment_results"("storeId", "resultKey");
CREATE UNIQUE INDEX "experiment_winner_store_key_unique" ON "experiment_winners"("storeId", "winnerKey");
CREATE INDEX "experiment_history_store_changed_idx" ON "experiment_history"("storeId", "changedAt");
CREATE INDEX "experiment_learning_store_event_idx" ON "experiment_learning"("storeId", "eventType", "emittedAt");
CREATE INDEX "experiment_confidence_store_computed_idx" ON "experiment_confidences"("storeId", "computedAt");

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_templates" ADD CONSTRAINT "experiment_templates_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_opportunities" ADD CONSTRAINT "experiment_opportunities_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_recommendations" ADD CONSTRAINT "experiment_recommendations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_recommendations" ADD CONSTRAINT "experiment_recommendations_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_baselines" ADD CONSTRAINT "experiment_baselines_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_baselines" ADD CONSTRAINT "experiment_baselines_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_observations" ADD CONSTRAINT "experiment_observations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_observations" ADD CONSTRAINT "experiment_observations_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_results" ADD CONSTRAINT "experiment_results_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_results" ADD CONSTRAINT "experiment_results_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_winners" ADD CONSTRAINT "experiment_winners_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_winners" ADD CONSTRAINT "experiment_winners_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_history" ADD CONSTRAINT "experiment_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_history" ADD CONSTRAINT "experiment_history_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_learning" ADD CONSTRAINT "experiment_learning_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_learning" ADD CONSTRAINT "experiment_learning_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_confidences" ADD CONSTRAINT "experiment_confidences_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_confidences" ADD CONSTRAINT "experiment_confidences_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
