-- Production hardening indexes and connector_sync job type
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'connector_sync';

CREATE INDEX IF NOT EXISTS "webhook_events_processed_created_idx"
  ON "webhook_events" ("processedSuccessfully", "createdAt");

CREATE INDEX IF NOT EXISTS "webhook_events_processing_expires_idx"
  ON "webhook_events" ("processingExpiresAt");

CREATE INDEX IF NOT EXISTS "sync_jobs_stale_lock_idx"
  ON "sync_jobs" ("status", "lockExpiresAt");
