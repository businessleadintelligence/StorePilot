-- F.6.18 high severity elimination
-- Dependency repair: sync_jobs / store_onboarding ALTERs moved to 20260621225938_add_async_jobs_foundation

ALTER TABLE "stores"
ADD COLUMN "firstTrialStartedAt" TIMESTAMPTZ;
