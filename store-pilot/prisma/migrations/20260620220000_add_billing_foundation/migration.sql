-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('products', 'orders', 'ai_requests', 'reports_generated');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "annualPrice" DECIMAL(10,2) NOT NULL,
    "maxProducts" INTEGER NOT NULL,
    "maxOrders" INTEGER NOT NULL,
    "maxTeamMembers" INTEGER NOT NULL,
    "aiCreditsPerMonth" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "currentPeriodStart" TIMESTAMPTZ NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ NOT NULL,
    "trialEndsAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "month" VARCHAR(7) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_storeId_key" ON "subscriptions"("storeId");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("planId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_store_metric_month_unique" ON "usage_records"("storeId", "metric", "month");

-- CreateIndex
CREATE INDEX "usage_records_store_month_idx" ON "usage_records"("storeId", "month");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- F.6.14 (moved from 20260620120000_f614_high_elimination): subscription lifecycle audit
ALTER TABLE "subscriptions" ADD COLUMN "endedAt" TIMESTAMPTZ;

CREATE INDEX "subscriptions_ended_at_idx" ON "subscriptions"("endedAt");

-- Seed default plans
INSERT INTO "plans" (
    "name",
    "slug",
    "monthlyPrice",
    "annualPrice",
    "maxProducts",
    "maxOrders",
    "maxTeamMembers",
    "aiCreditsPerMonth",
    "active",
    "updatedAt"
) VALUES
    ('Starter', 'starter', 49.00, 490.00, 1000, 5000, 2, 100, true, CURRENT_TIMESTAMP),
    ('Growth', 'growth', 99.00, 990.00, 10000, 50000, 10, 500, true, CURRENT_TIMESTAMP),
    ('Agency', 'agency', 199.00, 1990.00, 100000, 500000, 50, 2000, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
