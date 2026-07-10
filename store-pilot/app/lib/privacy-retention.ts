/**
 * Retention windows for privacy-first data lifecycle management.
 * See docs/audit/DATA_CLASSIFICATION.md for table-level tags.
 */

export const CUSTOMER_DATA_EXPORT_RETENTION_DAYS = 30;

export const WEBHOOK_EVENT_RETENTION_DAYS = 30;

export const SYNC_JOB_RETENTION_DAYS = 14;

export const JOB_EVENT_RETENTION_DAYS = 30;

export const AI_AGENT_RUN_RETENTION_DAYS = 90;

export const AI_AGENT_RESULT_RETENTION_DAYS = 90;

export const EVIDENCE_HISTORY_RETENTION_DAYS = 180;

export const EVIDENCE_OBSERVATION_RETENTION_DAYS = 180;

export const AI_RESULT_CACHE_RETENTION_DAYS = 7;

export function retentionCutoffDate(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function customerDataExportExpiresAt(
  now = new Date(),
  retentionDays = CUSTOMER_DATA_EXPORT_RETENTION_DAYS,
): Date {
  return new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}
