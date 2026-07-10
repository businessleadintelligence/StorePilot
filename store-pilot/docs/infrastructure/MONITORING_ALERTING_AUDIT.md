# Monitoring and Alerting Audit

## Current State

Monitoring checks exist in code, but no external alert delivery was found. Worker health creates alert strings; documentation acknowledges that Slack/PagerDuty integration is missing.

## Strengths

- Checks exist for database, Supabase/Postgres connectivity, Shopify API env, cron, queue, worker infrastructure, and AI provider health.
- Worker health can identify no active workers, stale workers, dead letters, old queued jobs, and orphan jobs.
- Startup readiness can detect missing secrets and missing migrations.

## Weaknesses

- No PagerDuty, Slack, email, Ops channel, Sentry, Datadog, or Better Stack integration in repo.
- No backup failure alert.
- No migration failure alert.
- No cost spike alert.
- No dependency outage alert integration.
- No alert severity model or escalation policy.

## Risk Level

Critical. Pull-only health endpoints are not sufficient for production operations.

## Recommendations

- P0 alerts to PagerDuty: database unavailable, no active workers, queue oldest age over SLO, dead-letter count over threshold, cron heartbeat missed, backup failed, GDPR delete failed.
- P1 alerts to Slack/Ops: Shopify error spike, AI provider error spike, high latency, cost spike, migration failure, stale worker, retry storm.
- P2 alerts to email/admin: merchant-specific usage warnings and non-critical integration degradation.
- Add alert tests and monthly incident drills.

## Priority

P0.

## Estimated Engineering Effort

1 to 2 weeks.
