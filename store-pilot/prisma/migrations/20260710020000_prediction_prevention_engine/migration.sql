-- CreateEnum
CREATE TYPE "PredictionType" AS ENUM ('inventory_stockout', 'revenue_forecast', 'seo_traffic_decline', 'pricing_margin_risk', 'refund_increase', 'collection_inactive', 'operational_supplier_delay');

-- CreateEnum
CREATE TYPE "ForecastWindow" AS ENUM ('days_4', 'days_7', 'days_12', 'days_30', 'next_week');

-- CreateEnum
CREATE TYPE "PreventionActionType" AS ENUM ('restock', 'fix_metadata', 'review_product', 'adjust_pricing', 'refresh_collection', 'review_supplier', 'monitor_trend');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'prediction_generate';

-- CreateTable predictions (+ related tables - see prisma schema for full DDL)
CREATE TABLE "predictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "predictionKey" VARCHAR(120) NOT NULL,
    "predictionType" "PredictionType" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "forecastWindow" "ForecastWindow" NOT NULL DEFAULT 'days_7',
    "predictedOutcome" VARCHAR(300) NOT NULL,
    "predictedValue" DECIMAL(12,4),
    "predictedUnit" VARCHAR(50) NOT NULL DEFAULT '',
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "contributingSignals" JSONB NOT NULL DEFAULT '[]',
    "historicalSupport" JSONB NOT NULL DEFAULT '{}',
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "graphNodeIds" JSONB NOT NULL DEFAULT '[]',
    "timelineIds" JSONB NOT NULL DEFAULT '[]',
    "rootCauseIds" JSONB NOT NULL DEFAULT '[]',
    "expectedBusinessImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rankScore" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prediction_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "predictionId" UUID NOT NULL,
    "changeType" VARCHAR(50) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prediction_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prediction_confidences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "predictionId" UUID NOT NULL,
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "signalStrength" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "historicalSupport" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "timelineSupport" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "rootCauseSupport" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "forecastModelSupport" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "confidenceJson" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prediction_confidences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "modelKey" VARCHAR(120) NOT NULL,
    "modelType" VARCHAR(100) NOT NULL,
    "modelJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "forecast_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "snapshotKey" VARCHAR(120) NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forecast_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prevention_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "predictionId" UUID NOT NULL,
    "actionKey" VARCHAR(120) NOT NULL,
    "actionType" "PreventionActionType" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "recommendedAction" VARCHAR(300) NOT NULL,
    "expectedImpactProtected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedPreventionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "estimatedEffort" INTEGER NOT NULL DEFAULT 2,
    "estimatedTimeMinutes" INTEGER NOT NULL DEFAULT 30,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "prevention_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "risk_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "predictionId" UUID,
    "riskType" VARCHAR(100) NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskJson" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_accuracy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "predictionType" "PredictionType" NOT NULL,
    "predictedValue" DECIMAL(12,4) NOT NULL,
    "actualValue" DECIMAL(12,4),
    "accuracyScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evaluatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forecast_accuracy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_stability" (
    "storeId" UUID NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "forecastVolatilityScore" INTEGER NOT NULL DEFAULT 0,
    "inventoryRiskScore" INTEGER NOT NULL DEFAULT 0,
    "revenueStabilityScore" INTEGER NOT NULL DEFAULT 0,
    "supplierReliabilityScore" INTEGER NOT NULL DEFAULT 0,
    "seasonalUncertaintyScore" INTEGER NOT NULL DEFAULT 0,
    "pricingStabilityScore" INTEGER NOT NULL DEFAULT 0,
    "trafficConsistencyScore" INTEGER NOT NULL DEFAULT 0,
    "scoreJson" JSONB NOT NULL DEFAULT '{}',
    "lastComputedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "business_stability_pkey" PRIMARY KEY ("storeId")
);

CREATE UNIQUE INDEX "prediction_store_key_unique" ON "predictions"("storeId", "predictionKey");
CREATE INDEX "prediction_store_rank_idx" ON "predictions"("storeId", "active", "rankScore");
CREATE INDEX "prediction_history_store_changed_idx" ON "prediction_history"("storeId", "changedAt");
CREATE INDEX "prediction_confidence_store_computed_idx" ON "prediction_confidences"("storeId", "computedAt");
CREATE UNIQUE INDEX "forecast_model_store_key_unique" ON "forecast_models"("storeId", "modelKey");
CREATE UNIQUE INDEX "forecast_snapshot_store_key_unique" ON "forecast_snapshots"("storeId", "snapshotKey");
CREATE INDEX "forecast_snapshot_store_created_idx" ON "forecast_snapshots"("storeId", "createdAt");
CREATE UNIQUE INDEX "prevention_action_store_key_unique" ON "prevention_actions"("storeId", "actionKey");
CREATE INDEX "prevention_action_store_active_idx" ON "prevention_actions"("storeId", "active");
CREATE INDEX "risk_assessment_store_computed_idx" ON "risk_assessments"("storeId", "computedAt");
CREATE INDEX "forecast_accuracy_store_evaluated_idx" ON "forecast_accuracy"("storeId", "evaluatedAt");

ALTER TABLE "predictions" ADD CONSTRAINT "predictions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prediction_history" ADD CONSTRAINT "prediction_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prediction_history" ADD CONSTRAINT "prediction_history_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prediction_confidences" ADD CONSTRAINT "prediction_confidences_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prediction_confidences" ADD CONSTRAINT "prediction_confidences_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_models" ADD CONSTRAINT "forecast_models_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prevention_actions" ADD CONSTRAINT "prevention_actions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prevention_actions" ADD CONSTRAINT "prevention_actions_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "forecast_accuracy" ADD CONSTRAINT "forecast_accuracy_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_stability" ADD CONSTRAINT "business_stability_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
