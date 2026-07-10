-- CreateEnum
CREATE TYPE "QuickWinCategory" AS ENUM ('inventory', 'seo', 'pricing', 'collections', 'operations', 'catalog');

-- CreateEnum
CREATE TYPE "QuickWinType" AS ENUM ('inventory_risk', 'missing_seo', 'missing_meta_description', 'missing_alt_text', 'dead_product', 'never_sold_product', 'low_stock', 'overstock', 'bundle_candidate', 'pricing_outlier', 'collection_issue', 'draft_too_long', 'no_images', 'no_description', 'margin_risk', 'slow_moving_product', 'inactive_product', 'high_refund_risk', 'out_of_stock');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'quick_wins_generate';

-- CreateTable
CREATE TABLE "quick_wins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "winType" "QuickWinType" NOT NULL,
    "category" "QuickWinCategory" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "businessImpact" INTEGER NOT NULL DEFAULT 0,
    "estimatedEffort" INTEGER NOT NULL DEFAULT 2,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "revenueOpportunity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "urgency" INTEGER NOT NULL DEFAULT 0,
    "rankScore" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "sourceFactTypes" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quick_wins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_win_summary" (
    "storeId" UUID NOT NULL,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "estimatedRevenueOpportunity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "topCategories" JSONB NOT NULL DEFAULT '[]',
    "headline" VARCHAR(500) NOT NULL DEFAULT '',
    "lastGeneratedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quick_win_summary_pkey" PRIMARY KEY ("storeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "quick_win_store_type_unique" ON "quick_wins"("storeId", "winType");

-- CreateIndex
CREATE INDEX "quick_win_store_rank_idx" ON "quick_wins"("storeId", "active", "rankScore");

-- AddForeignKey
ALTER TABLE "quick_wins" ADD CONSTRAINT "quick_wins_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_win_summary" ADD CONSTRAINT "quick_win_summary_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
