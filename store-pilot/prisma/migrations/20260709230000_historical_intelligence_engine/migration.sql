-- CreateEnum
CREATE TYPE "MerchantBaselineType" AS ENUM ('revenue', 'pricing', 'inventory', 'category', 'vendor', 'seasonality', 'refund', 'growth', 'operational');

-- CreateEnum
CREATE TYPE "PatternSeedType" AS ENUM ('weekend_sales_lift', 'high_refund_rate', 'inventory_pressure', 'seasonal_candidate', 'pricing_volatility', 'category_concentration', 'vendor_concentration', 'order_growth');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'historical_intelligence';

-- CreateTable
CREATE TABLE "historical_memory" (
    "storeId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "memoryJson" JSONB NOT NULL DEFAULT '{}',
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "graphVersion" INTEGER,
    "patternSeedCount" INTEGER NOT NULL DEFAULT 0,
    "baselineCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "lastBuiltAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "historical_memory_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "historical_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "memorySnapshot" JSONB NOT NULL,
    "baselineSnapshot" JSONB NOT NULL,
    "patternSnapshot" JSONB NOT NULL,
    "graphVersion" INTEGER,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_seeds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "patternType" "PatternSeedType" NOT NULL,
    "semanticLabel" VARCHAR(150) NOT NULL,
    "patternJson" JSONB NOT NULL DEFAULT '{}',
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pattern_seeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confidence_seeds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "domain" VARCHAR(100) NOT NULL,
    "confidencePercent" INTEGER NOT NULL DEFAULT 0,
    "baselinePercent" INTEGER NOT NULL DEFAULT 0,
    "evidenceCoverage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "graphCoverage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "source" VARCHAR(100) NOT NULL DEFAULT 'historical_import',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "confidence_seeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_baselines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "baselineType" "MerchantBaselineType" NOT NULL,
    "baselineJson" JSONB NOT NULL DEFAULT '{}',
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "merchant_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_dna_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "dnaJson" JSONB NOT NULL,
    "graphVersion" INTEGER,
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_dna_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "historical_snapshot_store_version_unique" ON "historical_snapshots"("storeId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "pattern_seed_unique" ON "pattern_seeds"("storeId", "patternType", "semanticLabel");

-- CreateIndex
CREATE INDEX "pattern_seed_store_active_idx" ON "pattern_seeds"("storeId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "confidence_seed_store_domain_unique" ON "confidence_seeds"("storeId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_baseline_store_type_unique" ON "merchant_baselines"("storeId", "baselineType");

-- CreateIndex
CREATE UNIQUE INDEX "business_dna_version_store_unique" ON "business_dna_versions"("storeId", "versionNumber");

-- AddForeignKey
ALTER TABLE "historical_memory" ADD CONSTRAINT "historical_memory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_snapshots" ADD CONSTRAINT "historical_snapshots_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_seeds" ADD CONSTRAINT "pattern_seeds_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confidence_seeds" ADD CONSTRAINT "confidence_seeds_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_baselines" ADD CONSTRAINT "merchant_baselines_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_dna_versions" ADD CONSTRAINT "business_dna_versions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
