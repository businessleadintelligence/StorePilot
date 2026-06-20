-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('starter', 'growth', 'agency');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shopifyDomain" VARCHAR(255) NOT NULL,
    "shopifyId" VARCHAR(100) NOT NULL,
    "accessToken" TEXT NOT NULL,
    "storeName" VARCHAR(255) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'starter',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "trialEndsAt" TIMESTAMPTZ,
    "ga4PropertyId" VARCHAR(100),
    "ga4RefreshToken" TEXT,
    "ga4ConnectedAt" TIMESTAMPTZ,
    "briefingTime" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "briefingTimezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "historicalImportDone" BOOLEAN NOT NULL DEFAULT false,
    "lastOrdersSyncAt" TIMESTAMPTZ,
    "lastInventorySyncAt" TIMESTAMPTZ,
    "lastRefundsSyncAt" TIMESTAMPTZ,
    "lastProductsSyncAt" TIMESTAMPTZ,
    "lastGa4SyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_shopifyDomain_key" ON "stores"("shopifyDomain");

-- CreateIndex
CREATE UNIQUE INDEX "stores_shopifyId_key" ON "stores"("shopifyId");

-- CreateIndex
CREATE INDEX "stores_active_subscriptionPlan_idx" ON "stores"("active", "subscriptionPlan");

-- CreateIndex
CREATE INDEX "stores_briefingTime_idx" ON "stores"("briefingTime");
