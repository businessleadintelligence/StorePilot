-- CreateTable
CREATE TABLE "google_integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "googleAccountId" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "connectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMPTZ,
    "analyticsPropertyId" VARCHAR(100),
    "analyticsPropertyName" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "google_integrations_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "store_onboarding" ADD COLUMN "googleAnalyticsSkippedAt" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "google_integrations_storeId_key" ON "google_integrations"("storeId");

-- CreateIndex
CREATE INDEX "google_integrations_active_sync_idx" ON "google_integrations"("isActive", "lastSyncAt");

-- AddForeignKey
ALTER TABLE "google_integrations" ADD CONSTRAINT "google_integrations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
