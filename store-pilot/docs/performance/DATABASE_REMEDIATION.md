# Database Remediation — P0 Sprint

**Date:** 2026-07-10

---

## Problem

Production `/health/monitor` showed p95 query duration **~10.5s** and 100% slow-query rate under pool contention. Cron cycles logged repeated `[db-slow-query]` for:

- 7× `SyncJob.count({ status })` per health check
- Unbounded `StoreOnboarding.findMany` with joins
- Unbounded prediction/root-cause reads on dashboard

Missing `connection_limit` / `pool_timeout` on serverless `DATABASE_URL`.

---

## Changes implemented

### 1. Grouped queue counts

`getJobQueueMetrics()` (`app/services/job.server.ts`):

```sql
SELECT status, COUNT(*)::bigint FROM sync_jobs GROUP BY status
```

Replaces 7 parallel `count()` queries → **1 round-trip**.

### 2. Batched onboarding reconciliation

- `reconcileOnboardingWithCompletedJobs`: `take: 50`, `orderBy: updatedAt asc`
- `findStuckOnboarding`: `take: 50`, reduced `currentJob` select fields

### 3. Pagination on dashboard APIs

- `getPredictions`: `take: 20`
- `getRootCauses`: `take: 20`

### 4. Indexes (migration `20260710160000_p0_query_performance_indexes`)

| Index | Justification |
|-------|---------------|
| `store_onboarding_repair_idx` | `WHERE ownershipRepairPending = true` — worker repair path |
| `store_onboarding_active_job_idx` | Reconcile query: active status + currentJobId |
| `sync_jobs_status_queued_idx` | Partial index for queue depth on hot status |
| `sync_jobs_status_retrying_idx` | Partial index for retry queue |

### 5. Pool configuration (operational — not code)

Recommended production `DATABASE_URL` params:

```
?pgbouncer=true&connection_limit=1&pool_timeout=15
```

Documented in `packages/database/pool-config.ts` (existing audit warnings).

---

## Expected impact

| Query pattern | Before (reported) | Expected after |
|---------------|-------------------|----------------|
| Queue metrics | 7 × 700ms–1.7s | 1 × 50–200ms |
| Onboarding reconcile | ~750ms unbounded | ~100–300ms batched |
| Dashboard prediction/root | unbounded scan | capped at 20 rows |

---

## Verification status

| Item | Status |
|------|--------|
| Unit tests | ✅ 3034 pass |
| Migration file created | ✅ |
| Migration applied to production | 🟡 Requires deploy |
| Live p95 query reduction | 🟡 Requires `/health/monitor` after deploy |

---

## Files changed

- `app/services/job.server.ts`
- `app/services/onboarding.server.ts`
- `app/prediction/api/prediction-api.ts`
- `app/root-cause/api/root-cause-api.ts`
- `prisma/migrations/20260710160000_p0_query_performance_indexes/migration.sql`
