-- AlterTable
ALTER TABLE "google_integrations" ADD COLUMN "searchConsoleSiteUrl" VARCHAR(512);
ALTER TABLE "google_integrations" ADD COLUMN "searchConsoleSiteName" VARCHAR(255);
ALTER TABLE "google_integrations" ADD COLUMN "searchConsoleLastSyncAt" TIMESTAMPTZ;
