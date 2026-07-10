# Query Optimization Report — P0 Sprint

**Date:** 2026-07-10

---

## SyncJob

### Before

```typescript
// 7 parallel round-trips — app/services/job.server.ts
prisma.syncJob.count({ where: { status: JobStatus.queued } })
// × 7 statuses
```

**Issue:** No single-column `status` index optimized for bare equality; each count potentially scans large partition.

### After

```typescript
prisma.$queryRaw`
  SELECT status, COUNT(*)::bigint AS count
  FROM sync_jobs
  GROUP BY status
`
```

**Gain:** 7 queries → 1. Estimated **85% reduction** in queue metrics latency.

### Indexes added

- `sync_jobs_status_queued_idx` ON `(created_at) WHERE status = 'queued'`
- `sync_jobs_status_retrying_idx` ON `(created_at) WHERE status = 'retrying'`

**Justification:** Health alerts use queue depth + oldest job age on queued/retrying statuses.

---

## StoreOnboarding

### reconcileOnboardingWithCompletedJobs

| Aspect | Before | After |
|--------|--------|-------|
| Batch limit | None | `take: 50` |
| Order | Undefined | `updatedAt asc` (oldest first) |
| Include | Full `currentJob` | Full (test harness compat) |

### findStuckOnboarding

| Aspect | Before | After |
|--------|--------|-------|
| Batch limit | None | `take: 50` |
| currentJob fields | All columns | id, status, lockExpiresAt, heartbeatAt, jobType, errorMessage |

### Indexes added

- `store_onboarding_repair_idx` — partial on `ownershipRepairPending = true`
- `store_onboarding_active_job_idx` — partial on active statuses with `currentJobId`

---

## Prediction / RootCause (dashboard)

| API | Before | After |
|-----|--------|-------|
| `getPredictions` | unbounded findMany | `take: 20` |
| `getRootCauses` | unbounded findMany | `take: 20` |

UI already slices to 8 items; fetching all rows was unnecessary.

---

## StoreMetrics (dashboard shell — unchanged query shape)

7 parallel counts remain in blocking path — **future optimization**:

- Materialized count cache table updated by worker
- Or single raw SQL aggregation query

Not changed in P0 to avoid business logic impact.

---

## EXPLAIN recommendations (not executed)

Run on staging after migration deploy:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT status, COUNT(*) FROM sync_jobs GROUP BY status;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM store_onboarding
WHERE status NOT IN ('completed', 'failed')
  AND "currentJobId" IS NOT NULL
ORDER BY "updatedAt" ASC
LIMIT 50;
```

Expected: Index Scan or Bitmap Index Scan on partial indexes; no Seq Scan on large tables.

---

## N+1 status

| Pattern | Resolved? |
|---------|-----------|
| 7× SyncJob count | ✅ |
| Sequential intelligence loader | ✅ (promises + stream) |
| Double auth session load | ✅ |
| reconcile loop updates | Partial — batched find, per-row update retained |

---

## Query count estimate: dashboard index loader

| Phase | Queries |
|-------|---------|
| Auth (cached) | 1 |
| Store lookup | 1 |
| Shell parallel block | ~11 |
| Deferred intelligence | ~20 (non-blocking) |
| **Blocking total** | **~13** |

Down from **~35–45 blocking** in investigation.
