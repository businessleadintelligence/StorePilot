# Worker Infrastructure Report

**Date:** 2026-07-09  
**Sprint:** Production Worker Infrastructure Hardening  
**Scope:** Infrastructure only

---

## Executive summary

StorePilot's job queue was **architecturally sound** but **operationally dependent on Vercel Cron**, which was configured at once-daily frequency. Bootstrap jobs remained `queued` indefinitely after OAuth.

This sprint adds a **continuous worker process**, **worker instance registry**, **extended queue metrics**, **orphan detection**, and **production health endpoints** — without modifying Shopify sync, onboarding business rules, or AI features.

---

## Pre-hardening audit

### Queue (`sync_jobs`)

| Capability | Before | Gap |
|------------|--------|-----|
| Postgres queue | ✅ | — |
| Priority ordering | ✅ | — |
| Idempotent enqueue | ✅ | — |
| `FOR UPDATE SKIP LOCKED` | ✅ | — |
| Status `retrying` in schema | ✅ | Never written (used `queued`) |
| Status `claimed` | ❌ | Claim jumped directly to `running` |
| Exponential retry | ✅ | No jitter |
| Dead-letter | ✅ | Manual replay only |
| Visibility timeout | ✅ | Fixed 5m, not env-configurable |

### Worker lifecycle

| Capability | Before | Gap |
|------------|--------|-----|
| HTTP cron worker | ✅ | Daily schedule in production |
| Continuous worker | ❌ | No `npm run worker` |
| Graceful shutdown | ❌ | Prisma disconnect only |
| Worker heartbeat (instance) | ❌ | Job heartbeat only |
| Worker registry | ❌ | Ephemeral cron-worker IDs |

### Concurrency & safety

| Capability | Before | Gap |
|------------|--------|-----|
| Multi-worker claim safety | ✅ | — |
| Worker ownership | ✅ | — |
| Stale lock recovery | ✅ | Per-job transactions |
| Orphan detection | Partial | Onboarding reconcile only |
| Worker offline detection | ❌ | — |

### Monitoring

| Metric | Before | After |
|--------|--------|-------|
| Queue counts | Basic 4-field | 7 states + depth |
| Wait time | ❌ | 24h average |
| Execution time | ❌ | 24h average |
| Longest queued job | ❌ | Age + ID |
| Throughput | ❌ | Jobs/hour |
| Worker uptime | ❌ | `worker_instances` |
| Dedicated health endpoint | ❌ | `/health/worker` |

---

## Changes implemented

### Schema migration `20260709143000_worker_infrastructure`

- Added `JobStatus.claimed`
- Added `WorkerInstanceStatus` enum
- Added `worker_instances` table

### Job service enhancements (`job.server.ts`)

- Two-phase claim: `claimed` → `beginJobExecution` → `running`
- Retry path uses `retrying` status (claimable alongside `queued`)
- Exponential backoff with jitter
- Configurable lock duration via `JOB_LOCK_DURATION_MS`
- `detectOrphanJobs` / `recoverOrphanJobs`
- Extended `getJobQueueMetrics` (7 counters)

### New services

| File | Purpose |
|------|---------|
| `worker-runtime.server.ts` | Continuous poll loop, SIGTERM/SIGINT drain |
| `worker-registry.server.ts` | Instance registration + heartbeat |
| `worker-metrics.server.ts` | Latency, depth, throughput |
| `worker-health.server.ts` | Aggregated health payload |

### Routes & deployment

| Change | Details |
|--------|---------|
| `GET /health/worker` | Full worker infrastructure health |
| `npm run worker` | Continuous worker entrypoint |
| `Dockerfile.worker` | Container deployment |
| `vercel.json` | Worker cron `*/2 * * * *` (fallback) |

### Worker engine (`worker.server.ts`)

- Calls `beginJobExecution` after claim
- `runWorkerCycle` uses full batch size (not hardcoded 1)
- Exported `prepareWorkerQueue`

---

## Verification

| Check | Status |
|-------|--------|
| Business logic unchanged | ✅ No changes to sync/AI handlers |
| Multi-worker safe | ✅ SKIP LOCKED + generation |
| No double execution | ✅ Ownership + idempotency |
| Crash recovery | ✅ Stale release + orphan detection |
| Tests updated | ✅ f33, f38, monitoring, infrastructure |

---

## Residual recommendations

1. **Deploy continuous worker** to Railway/Fly before next production install
2. **Alert on** `no_active_workers` and `dead_letter_jobs` via `/health/worker`
3. **Add retry-queue cron** to `vercel.json` for stale-lock-only sweeps (Pro config reference exists)
4. **Consider** Prometheus exporter wrapping `getExtendedJobQueueMetrics`

---

## Related documents

- [WORKER_ARCHITECTURE.md](./WORKER_ARCHITECTURE.md)
- [JOB_LIFECYCLE.md](./JOB_LIFECYCLE.md)
- [WORKER_MIGRATION_PLAN.md](./WORKER_MIGRATION_PLAN.md)
- [BOOTSTRAP_SYNC_AUDIT.md](./BOOTSTRAP_SYNC_AUDIT.md)
