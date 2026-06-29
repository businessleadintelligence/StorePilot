-- F.6.18 high severity elimination

ALTER TABLE "stores"
ADD COLUMN "firstTrialStartedAt" TIMESTAMPTZ;

ALTER TABLE "sync_jobs"
ADD COLUMN "workerGeneration" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "store_onboarding"
ADD COLUMN "ownershipRepairPending" BOOLEAN NOT NULL DEFAULT false;
