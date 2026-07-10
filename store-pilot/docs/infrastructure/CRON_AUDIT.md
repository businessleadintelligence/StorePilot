# Cron Audit

## Current State

Vercel cron triggers `/cron/worker` and several `/cron/dispatch/:jobId` endpoints. Cron auth requires `CRON_SECRET`. `vercel.pro.crons.json` includes additional production schedules for retry queue, expired sessions, metrics aggregation, and recommendation refresh.

## Strengths

- Cron endpoints validate `CRON_SECRET` through bearer or `x-cron-secret`.
- Dispatch endpoint validates known job IDs before execution.
- Cron jobs are mostly idempotent enqueue or cleanup operations.
- There is a retry-queue cron implementation.
- Cleanup jobs include webhook event retention cleanup.

## Weaknesses

- Schedule drift between `vercel.json` and `vercel.pro.crons.json`.
- No external alert if a cron fails or stops firing.
- Overlap/locking strategy is per job behavior, not a generic cron lease.
- No manual replay CLI/runbook was found for every cron.
- Some failure paths log but do not alert.

## Risk Level

High until the cron source of truth is fixed and external cron monitoring exists.

## Recommendations

- Consolidate cron schedules into one canonical manifest.
- Add a cron execution table or heartbeat record for each scheduled job.
- Alert when expected cron heartbeat is late.
- Add generic cron lease/overlap prevention for long-running dispatch jobs.
- Add manual replay commands in runbooks.

## Priority

P0 for schedule drift. P1 for cron alerting and heartbeat records.

## Estimated Engineering Effort

3 to 7 days.
