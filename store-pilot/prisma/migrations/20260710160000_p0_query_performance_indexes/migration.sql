-- P0 production stabilization: indexes justified by worker reconcile + queue metrics paths

CREATE INDEX IF NOT EXISTS store_onboarding_repair_idx
  ON store_onboarding ("storeId")
  WHERE "ownershipRepairPending" = true;

CREATE INDEX IF NOT EXISTS store_onboarding_active_job_idx
  ON store_onboarding (status, "currentJobId")
  WHERE status NOT IN ('completed', 'failed') AND "currentJobId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS sync_jobs_status_queued_idx
  ON sync_jobs ("createdAt")
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS sync_jobs_status_retrying_idx
  ON sync_jobs ("createdAt")
  WHERE status = 'retrying';
