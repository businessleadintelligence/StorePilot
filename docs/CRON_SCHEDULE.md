# StorePilot Cron Schedule

Production cron scheduling for StorePilot on Vercel. All scheduled jobs are defined in `store-pilot/vercel.json` and implemented in `app/services/cron-scheduler.server.ts` and `app/services/cron-jobs.server.ts`.

## Overview

| Component | Path |
|-----------|------|
| Schedule registry | `app/services/cron-scheduler.server.ts` |
| Job runners | `app/services/cron-jobs.server.ts` |
| Auth | `app/services/cron-auth.server.ts` |
| Dispatch route | `GET/POST /cron/dispatch/:jobId` |
| Schedule listing | `GET /cron/schedule` |
| Worker route | `POST /cron/worker` |
| Vercel config | `store-pilot/vercel.json` |

## Authentication

All cron endpoints require `CRON_SECRET` in the deployment environment.

Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Manual or local invocations may also use `x-cron-secret: <CRON_SECRET>`.

```bash
# Vercel-style
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://store-pilot-eta.vercel.app/cron/dispatch/retry-queue

# Header-style
curl -H "x-cron-secret: $CRON_SECRET" \
  https://store-pilot-eta.vercel.app/cron/worker -X POST
```

`GET /cron/schedule` is unauthenticated and returns the full schedule registry for operations visibility.

## Production Schedule

All times are UTC (Vercel cron default).

| Job ID | Name | Schedule | Path | Purpose |
|--------|------|----------|------|---------|
| `worker` | Worker Queue | `*/2 * * * *` | `/cron/worker` | Process queued sync jobs |
| `retry-queue` | Retry Queue | `*/5 * * * *` | `/cron/dispatch/retry-queue` | Release stale worker locks |
| `expired-sessions` | Expired Sessions | `0 * * * *` | `/cron/dispatch/expired-sessions` | Delete expired Shopify sessions |
| `cleanup-jobs` | Cleanup Jobs | `0 2 * * *` | `/cron/dispatch/cleanup-jobs` | Purge old webhook events, clear leases |
| `knowledge-refresh` | Knowledge Refresh | `0 3 * * *` | `/cron/dispatch/knowledge-refresh` | Enqueue connector sync per store |
| `learning-engine` | Learning Engine | `0 4 * * *` | `/cron/dispatch/learning-engine` | Update merchant learning profiles |
| `daily-operating-plan` | Daily Operating Plan | `0 6 * * *` | `/cron/dispatch/daily-operating-plan` | Enqueue executive brief generation |
| `metrics-aggregation` | Metrics Aggregation | `0 */6 * * *` | `/cron/dispatch/metrics-aggregation` | Enqueue metrics recompute |
| `recommendation-refresh` | Recommendation Refresh | `0 7,19 * * *` | `/cron/dispatch/recommendation-refresh` | Enqueue recommendation regeneration |

### Daily timeline (UTC)

```
00:00  metrics-aggregation (every 6h: 00, 06, 12, 18)
02:00  cleanup-jobs
03:00  knowledge-refresh
04:00  learning-engine
06:00  daily-operating-plan
07:00  recommendation-refresh
19:00  recommendation-refresh
*:00   expired-sessions (hourly)
*/2    worker
*/5    retry-queue
```

## Job Details

### Worker Queue (`worker`)

- **Route:** `POST /cron/worker`
- **Handler:** `runWorkerCycle()` in `app/services/worker.server.ts`
- **Behavior:** Claims and executes queued `SyncJob` rows (connector sync, metrics, recommendations, etc.)

### Retry Queue (`retry-queue`)

- **Handler:** `runRetryQueueCron()`
- **Behavior:** Calls `releaseStaleJobs()` to return stuck jobs to the queue when worker leases expire

### Expired Sessions (`expired-sessions`)

- **Handler:** `runExpiredSessionsCron()`
- **Behavior:** `DELETE FROM Session WHERE expires < NOW()`

### Cleanup Jobs (`cleanup-jobs`)

- **Handler:** `runCleanupJobsCron()`
- **Behavior:**
  - Deletes processed webhook events older than 30 days
  - Clears expired `processingOwner` / `processingExpiresAt` leases on webhook events

### Knowledge Refresh (`knowledge-refresh`)

- **Handler:** `runKnowledgeRefreshCron()`
- **Enqueues:** `connector_sync` jobs for onboarded stores
- **Idempotency:** `cron:knowledge-refresh:{storeId}:{YYYY-MM-DD}`

### Learning Engine (`learning-engine`)

- **Handler:** `runLearningEngineCron()`
- **Behavior:** Loads operations snapshots, updates learning profiles from completed operations (up to 25 per store), persists via `saveOperationsSnapshot()`

### Daily Operating Plan (`daily-operating-plan`)

- **Handler:** `runDailyOperatingPlanCron()`
- **Enqueues:** `executive_brief_generate` jobs (high priority)
- **Worker execution:** `executeExecutiveBriefJob()` → `getExecutiveBrief()`
- **Idempotency:** `cron:daily-operating-plan:{storeId}:{YYYY-MM-DD}`

### Metrics Aggregation (`metrics-aggregation`)

- **Handler:** `runMetricsAggregationCron()`
- **Enqueues:** `metrics_recompute` jobs for active stores
- **Worker execution:** `executeMetricsRecomputeJob()` → `getStoreMetrics()`
- **Idempotency:** `cron:metrics-aggregation:{storeId}:{YYYY-MM-DDTHH}` (hourly bucket)

### Recommendation Refresh (`recommendation-refresh`)

- **Handler:** `runRecommendationRefreshCron()`
- **Enqueues:** `recommendations_generate` jobs for onboarded stores
- **Worker execution:** `executeRecommendationsGenerateJob()` → `getStoreRecommendations()`
- **Idempotency:** `cron:recommendation-refresh:{storeId}:{YYYY-MM-DD}`

## Production-Safe Design

1. **Staggered off-peak windows** — Heavy store-scoped jobs run between 02:00–07:00 UTC; recommendation refresh also runs at 19:00 UTC.
2. **Idempotency keys** — Daily/hourly buckets prevent duplicate enqueues when cron fires overlap or retry.
3. **Batch limits** — `CRON_STORE_BATCH_SIZE` (default 50, max 200) caps stores processed per run.
4. **Enqueue, don't block** — Store jobs are enqueued for the worker; cron handlers return quickly.
5. **Auth on all mutating endpoints** — Dispatch and worker routes reject requests without valid `CRON_SECRET`.
6. **Registry parity** — `vercel.json` crons match `listAllProductionSchedules()`; verify with `GET /cron/schedule?format=vercel`.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRON_SECRET` | Yes | — | Shared secret for cron authentication |
| `CRON_STORE_BATCH_SIZE` | No | `50` | Max stores per store-scoped cron run (max 200) |

## Operations

### List schedules

```bash
curl https://store-pilot-eta.vercel.app/cron/schedule
```

### Vercel-format export

```bash
curl "https://store-pilot-eta.vercel.app/cron/schedule?format=vercel"
```

### Manual dispatch (staging / debug)

```bash
for job in retry-queue expired-sessions cleanup-jobs knowledge-refresh \
  learning-engine daily-operating-plan metrics-aggregation recommendation-refresh; do
  curl -s -H "Authorization: Bearer $CRON_SECRET" \
    "https://store-pilot-eta.vercel.app/cron/dispatch/$job" | jq .
done
```

### Health monitoring

Cron health is included in `GET /health/monitor` via the `cron` check in `app/services/monitoring.server.ts`.

## Verification

Automated tests cover:

- `app/services/__tests__/cron-scheduler.test.ts` — auth, registry, all job runners, dispatch
- `app/routes/__tests__/cron-scheduler.test.ts` — schedule listing and dispatch routes
- `app/routes/__tests__/f42-cron-worker.test.ts` — worker cron endpoint

Run:

```bash
cd store-pilot
npm test -- cron-scheduler f42-cron-worker
npm run typecheck
npm run build
```

## Local Development

Vercel Cron does not run locally. Trigger jobs manually:

```bash
export CRON_SECRET=your-local-secret
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/cron/dispatch/retry-queue
curl -H "x-cron-secret: $CRON_SECRET" -X POST http://localhost:3000/cron/worker
```

Ensure `CRON_SECRET` is set in `.env` and matches the header value.
