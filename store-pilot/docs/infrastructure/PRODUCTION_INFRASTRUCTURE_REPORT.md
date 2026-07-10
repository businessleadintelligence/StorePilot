# StorePilot Production Infrastructure Report

Scope: repository and configuration evidence only. No external cloud dashboards were inspected. Missing infrastructure is treated as a gap, not assumed to exist.

## Production Readiness Score

Score: 54 / 100

Recommendation: NO-GO for broad production launch. StorePilot has strong application-level primitives for queueing, cron auth, startup checks, privacy guards, and AI credit controls, but it lacks production-grade external alerting, backup/restore proof, shared rate limiting, deployment hardening, and scale-ready database operations.

## Current State

StorePilot runs a Vercel-hosted Remix/React Router app, Vercel cron endpoints, a Railway-style continuous worker image, Prisma against Postgres/Supabase, Shopify APIs, optional Google/Microsoft integrations, and OpenAI/Anthropic AI providers. The queue is database-backed through SyncJob, WorkerInstance, and JobEvent tables. The worker uses heartbeats, lock expiry, retries, dead letters, and SKIP LOCKED claiming.

Key evidence:

- `vercel.json` defines build and cron entries.
- `vercel.pro.crons.json` contains a richer cron schedule than `vercel.json`.
- `Dockerfile.worker` runs `npm run worker`, which executes `npx tsx scripts/worker.ts`.
- `.env.example` documents required runtime, database, worker, AI, and integration secrets.
- `startup-readiness.server.ts` validates cron secret, Shopify credentials, scopes, database URL, token encryption key, migrations, and webhook config.
- `job.server.ts` implements queue claiming, retry, heartbeat, metrics, orphan detection, and dead-letter behavior.
- `worker-runtime.server.ts` implements continuous worker lifecycle and signal handling.
- `monitoring.server.ts` exposes health checks, but no push alert sink is wired in the repo.

## Strengths

- Database queue has lock expiry, retrying, dead-letter states, idempotency keys, and SKIP LOCKED claiming.
- Worker registry tracks worker instances, heartbeats, stale workers, and active worker IDs.
- Startup readiness validates several production-critical settings.
- Prisma pool guidance exists for serverless and worker contexts.
- Cron authentication uses CRON_SECRET and supports bearer or header-based auth.
- AI credit budget enforcement uses serialized transactional debit.
- Privacy and PII redaction helpers exist and are tested elsewhere in the repo.

## Weaknesses

- Production cron schedule appears split between `vercel.json` and `vercel.pro.crons.json`.
- Worker image runs TypeScript through tsx in production, retaining dev runtime dependency risk.
- External alerting is not implemented; health alerts are pull-based only.
- Backup and restore evidence is insufficient; no restore drill, PITR runbook, or automated verification was found.
- Rate limiting is mostly in-process and dependency-specific, not shared across serverless/worker instances.
- Metrics are mostly process-local or endpoint-based, not shipped to a durable monitoring backend.
- No evidence of Vercel/Railway deployment rollback automation, canary rollout, or release freeze procedure.
- No infrastructure-as-code definition for Supabase, Railway, Vercel projects, alerts, dashboards, or secrets.

## Risk Level

Critical for broad launch. Medium-High for a small private beta with strict caps and manual daily ops review.

## Risk Heatmap

| Domain | Risk | Level |
|---|---|---|
| Backup and restore | Unproven restore path | Critical |
| Alerting | No push alerting | Critical |
| Worker deployment | TS runtime in production image | High |
| Cron | Schedule drift | High |
| Database scale | No partitioning/archival plan for evidence growth | High |
| Rate limiting | Process-local limits | High |
| AI cost | USD ledger and alert webhooks incomplete | High |
| Queue | Monitoring thresholds incomplete | Medium-High |
| Secrets | Validation exists, rotation missing | Medium-High |
| Logging | Structured logger exists, inconsistent adoption | Medium |
| Vercel | Unknown function duration/memory/bundle limits | Medium |
| Disaster recovery | No scenario automation evidence | Critical |

## Top 20 Infrastructure Risks

1. No verified database restore process.
2. No external alerting for worker, queue, cron, database, AI, or backup failure.
3. Cron schedule drift between canonical files.
4. Worker image depends on tsx/dev tooling in production.
5. No shared distributed rate limiter.
6. Process-local database and worker metrics reset across instances.
7. No durable APM/log shipping evidence.
8. No Supabase PITR configuration evidence.
9. No migration rollback strategy.
10. No queue partitioning/archival strategy for high-volume job history.
11. No evidence table partitioning plan for billions of records.
12. No Vercel max duration/memory audit evidence.
13. No Railway autoscaling or concurrency policy in repo.
14. No canary or staged rollout automation.
15. No AI provider outage failover runbook wired to automation.
16. No cost-spike alert webhooks for Foundation USD ledger.
17. Shopify rate limiting is not globally coordinated.
18. Missing external uptime checks for health endpoints.
19. No disaster recovery ownership matrix.
20. No infrastructure-as-code source of truth.

## Top 20 Operational Risks

1. Production incident may be visible only when a user reports it.
2. Queue can age or starve without paging operators.
3. Dead-letter growth can remain untriaged.
4. Cron failures may silently skip maintenance work.
5. Executive COO scheduling swallows one failure path.
6. Worker current job tracking appears unwired.
7. Duplicate job execution remains possible for non-idempotent handlers.
8. Poison jobs can consume retries and operator time.
9. Large deletes for GDPR/shop redact can lock or time out at scale.
10. Unbounded JSON payload growth can increase storage and query cost.
11. AI budget warnings can stay in app state without ops notification.
12. Provider pricing changes may not be reflected in env-configured rates.
13. Secret rotation lacks a rehearsed procedure.
14. No evidence of backup failure alerting.
15. No evidence of migration failure alerting.
16. No runbook-owned RTO/RPO values in production config.
17. No ops drill cadence.
18. No dependency status-page integration.
19. No per-merchant abuse throttling for dashboard/API usage.
20. No emergency read-only mode implemented as an operational switch.

## Recommendations

StorePilot should close the P0 gaps before any broad launch: canonical cron deployment, verified backup restore, external alerting, hardened worker image, and queue SLO visibility. The backlog below is ordered by launch risk.

## Priority

Overall priority is P0 for launch safety. The highest-risk controls are backup/restore, alerting, cron correctness, worker runtime hardening, and deployment rollback.

## Prioritized Remediation Backlog

### P0

- Pick one canonical cron file and deploy the complete production schedule.
- Implement external alerting for worker down, queue backlog, dead letters, cron failures, database unavailable, and AI budget exceeded.
- Document and test database restore, including PITR availability and restore verification.
- Replace production worker `npx tsx` runtime with compiled JS and production-only dependencies.

### P1

- Add distributed rate limiting for Shopify, AI, dashboard APIs, webhook endpoints, command center, graph, prediction, and experiments.
- Export logs/metrics/traces to a durable backend such as Datadog, Better Stack, Axiom, Grafana Cloud, or Sentry.
- Add queue SLOs: oldest job age, retry storm rate, dead-letter rate, per-type backlog, stuck locks, and throughput.
- Wire `trackInFlightJob` during job execution and verify graceful shutdown.
- Add deployment runbooks for failed migration, rollback, canary, and worker drain.

### P2

- Add database partitioning/archival strategy for evidence, events, AI runs, job events, and graph snapshots.
- Add AI USD cost ledger dashboards and soft/hard spend alert webhooks.
- Add secret rotation playbooks and startup validation for all required provider secrets.
- Add external synthetic checks for `/health`, `/health/ready`, `/health/worker`, and cron endpoints.

### P3

- Add infrastructure-as-code for Vercel, Railway, Supabase, alerts, dashboards, and secrets.
- Add chaos drills for provider outage, worker failure, database failover, and queue backlog.
- Add cost forecasting automation and monthly capacity review.

## Estimated Engineering Effort

- P0: 1.5 to 3 engineering weeks.
- P1: 3 to 6 engineering weeks.
- P2: 4 to 8 engineering weeks.
- P3: 4 to 10 engineering weeks.

## Go / No-Go

No-Go for broad production or 100,000-store scale. Conditional Go for limited private beta only if P0 items are completed, real external monitoring is active, backups are verified, and rollout is capped to a small merchant cohort.

## Phased Rollout Plan

1. Staging: run full cron schedule, continuous worker, synthetic webhooks, load tests, backup restore drill, AI budget tests.
2. Canary: 1 to 5 friendly stores, one worker, strict AI caps, daily ops review.
3. Limited merchants: 25 to 100 stores, external alerts live, queue SLO dashboard, rollback drill complete.
4. Controlled growth: 100 to 1,000 stores, add worker scaling policy, DB capacity review, provider quota review.
5. General availability: only after DR drills, budget alerts, centralized observability, and runbooks are complete.

## Production Infrastructure Certification

Certification status: Not certified for general production launch.

Launch sign-off requires backup restore tested, external alerting configured, worker deployment hardened, canonical cron schedule deployed, queue SLO dashboard live, AI spend alerts live, and incident ownership assigned.


