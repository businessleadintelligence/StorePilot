-- CreateEnum
CREATE TYPE "StoreSizeTier" AS ENUM ('tiny', 'small', 'medium', 'large', 'enterprise');

-- CreateEnum
CREATE TYPE "LearningStage" AS ENUM ('initializing', 'historical_import', 'learning', 'operational', 'predictive', 'adaptive');

-- CreateEnum
CREATE TYPE "LearningVelocityTier" AS ENUM ('fast', 'medium', 'slow');

-- CreateEnum
CREATE TYPE "LearningDomain" AS ENUM ('inventory', 'products', 'pricing', 'seo', 'collections', 'operations', 'seasonality', 'vendor_reliability', 'refund_behaviour', 'elasticity', 'executive_coo', 'prediction');

-- CreateEnum
CREATE TYPE "LearningPriorityDomain" AS ENUM ('revenue', 'inventory', 'profitability', 'pricing', 'seo', 'collections', 'media', 'operations', 'seasonality');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'learning_bootstrap';

-- CreateTable
CREATE TABLE "store_learning_profile" (
    "storeId" UUID NOT NULL,
    "storeSize" "StoreSizeTier" NOT NULL DEFAULT 'small',
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "variantsCount" INTEGER NOT NULL DEFAULT 0,
    "collectionsCount" INTEGER NOT NULL DEFAULT 0,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "inventoryItemsCount" INTEGER NOT NULL DEFAULT 0,
    "locationsCount" INTEGER NOT NULL DEFAULT 0,
    "vendorsCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueTagsCount" INTEGER NOT NULL DEFAULT 0,
    "averageVariantsPerProduct" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "catalogComplexityScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "historicalDepthScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "operationalComplexityScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "estimatedHistoryMonths" INTEGER NOT NULL DEFAULT 0,
    "storeAgeDays" INTEGER NOT NULL DEFAULT 0,
    "oldestOrderAt" TIMESTAMPTZ,
    "newestOrderAt" TIMESTAMPTZ,
    "expectedLearningDurationMinutes" INTEGER NOT NULL DEFAULT 0,
    "workerEstimateMinutes" INTEGER NOT NULL DEFAULT 0,
    "futureAiCostEstimateUsd" DECIMAL(10,4),
    "bootstrapStatus" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "profileJson" JSONB NOT NULL DEFAULT '{}',
    "profiledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "store_learning_profile_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "learning_readiness" (
    "storeId" UUID NOT NULL,
    "stage" "LearningStage" NOT NULL DEFAULT 'initializing',
    "overallConfidencePercent" INTEGER NOT NULL DEFAULT 0,
    "inventoryConfidence" INTEGER NOT NULL DEFAULT 0,
    "productsConfidence" INTEGER NOT NULL DEFAULT 0,
    "pricingConfidence" INTEGER NOT NULL DEFAULT 0,
    "seoConfidence" INTEGER NOT NULL DEFAULT 0,
    "collectionsConfidence" INTEGER NOT NULL DEFAULT 0,
    "operationsConfidence" INTEGER NOT NULL DEFAULT 0,
    "seasonalityConfidence" INTEGER NOT NULL DEFAULT 0,
    "executiveCooReady" BOOLEAN NOT NULL DEFAULT false,
    "predictionReady" BOOLEAN NOT NULL DEFAULT false,
    "merchantMessage" VARCHAR(500) NOT NULL DEFAULT '',
    "stageExplanation" VARCHAR(500) NOT NULL DEFAULT '',
    "stageStartedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastComputedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "learning_readiness_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "learning_velocity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "domain" "LearningDomain" NOT NULL,
    "velocity" "LearningVelocityTier" NOT NULL,
    "statusLabel" VARCHAR(50) NOT NULL DEFAULT 'Learning',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "learning_velocity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_eta" (
    "storeId" UUID NOT NULL,
    "bootstrapDurationMinutes" INTEGER NOT NULL DEFAULT 0,
    "historicalImportMinutes" INTEGER NOT NULL DEFAULT 0,
    "graphBuildMinutes" INTEGER NOT NULL DEFAULT 0,
    "quickWinMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalEstimatedMinutes" INTEGER NOT NULL DEFAULT 0,
    "estimatedCompletionAt" TIMESTAMPTZ,
    "historyMonthsDisplay" INTEGER NOT NULL DEFAULT 12,
    "merchantHeadline" VARCHAR(500) NOT NULL DEFAULT '',
    "lastComputedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "learning_eta_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "learning_priorities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "domain" "LearningPriorityDomain" NOT NULL,
    "priorityOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "learning_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_velocity_store_domain_unique" ON "learning_velocity"("storeId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "learning_priority_store_domain_unique" ON "learning_priorities"("storeId", "domain");

-- CreateIndex
CREATE INDEX "learning_priority_store_order_idx" ON "learning_priorities"("storeId", "priorityOrder");

-- AddForeignKey
ALTER TABLE "store_learning_profile" ADD CONSTRAINT "store_learning_profile_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_readiness" ADD CONSTRAINT "learning_readiness_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_velocity" ADD CONSTRAINT "learning_velocity_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_eta" ADD CONSTRAINT "learning_eta_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_priorities" ADD CONSTRAINT "learning_priorities_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
