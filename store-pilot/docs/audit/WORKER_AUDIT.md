# Worker Infrastructure Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Architecture

PostgreSQL-backed job queue (`sync_jobs` table), not Redis/SQS.

**Entry points:**
- `scripts/worker.ts` — continuous worker (`npm run worker`)
- `app/routes/cron.worker.tsx` — Vercel cron fallback (every 2 min)
- `Dockerfile.worker` — dedicated container

**Core files:**
- `app/services/job.server.ts` (1,070 lines) — queue primitives
- `app/services/worker.server.ts` (928 lines) — job dispatcher
- `app/services/worker-runtime.server.ts` — polling loop
- `app/services/worker-registry.server.ts` — instance heartbeats
- `app/services/worker-health.server.ts` — health aggregation

---

## Reliability Features (Present)

| Feature | Implementation | File |
|---------|----------------|------|
| Atomic claiming | `FOR UPDATE SKIP LOCKED` | `job.server.ts:529` |
| Lock/visibility timeout | `lockExpiresAt` (default 5 min) | `job.server.ts` |
| Heartbeat extension | Every 60s during execution | `worker.server.ts` |
| Exponential backoff | `computeRetryAvailableAt()` capped 15 min | `job.server.ts:198` |
| Dead letter | `attempts >= maxAttempts` | `job.server.ts:1040` |
| Stale lock recovery | `releaseStaleJobs()` | Cron + worker cycle |
| Idempotency keys | Unique on `sync_jobs.idempotencyKey` | `job.server.ts:471` |
| Job event audit | `JobEvent` table | Throughout job lifecycle |
| Worker registry | Active worker tracking | `worker-registry.server.ts` |
| Graceful shutdown hooks | SIGINT/SIGTERM on DB client | `packages/database/client.ts` |
| Checkpointed pipelines | Knowledge/graph checkpoints | `checkpoint-store.ts` |

---

## Reliability Gaps

| Gap | Severity | Evidence |
|-----|----------|----------|
| Orphan recovery incomplete for offline workers | 🔴 High | `recoverOrphanJobs` only calls `releaseStaleJobs` — requires lock expiry, not offline status alone |
| `trackInFlightJob` never called | 🔴 High | `worker-runtime.server.ts:268` — shutdown can interrupt running job |
| Dead-letter replay not exposed | 🟠 High | `requeueDeadLetterJob()` exists, no route/UI |
| Static idempotency keys block re-runs | 🟠 High | `enqueueJob` returns existing job in any status |
| Fire-and-forget pipeline chaining | 🟠 High | `void scheduleX().catch(() => undefined)` in worker.server.ts |
| Attempts incremented at claim | 🟡 Medium | Consumes retry budget before work starts |
| Cron workers not registered | 🟡 Medium | Ephemeral IDs → false orphan alerts |
| No per-error retry classification | 🟡 Medium | All failures same retry path |
| Shopify automation idempotency in-memory | 🟡 Medium | `shopify-idempotency.ts` — lost on restart |
| AI request queue in-memory | 🟡 Medium | `ai/foundation/queue/request-queue.ts` |
| No store-level concurrency limit | 🟢 Low | Multiple jobs per store can run parallel |

---

## Idempotency Patterns

| Pattern | Example Key | File |
|---------|-------------|------|
| Onboarding phases | `onboarding:{storeId}:{phase}` | `onboarding.server.ts` |
| Time buckets | `orders-incremental:{storeId}:{15min}` | `orders-scheduler.server.ts` |
| Cron daily | `cron:daily-operating-plan:{storeId}:{date}` | `cron-jobs.server.ts` |
| Pipeline chain | `graph:after-ingest:{storeId}` | `worker.server.ts` |
| Webhook dedup | `shopifyWebhookId` unique | `webhook.server.ts` |

---

## Race Conditions

| Scenario | Mitigation | Residual Risk |
|----------|------------|---------------|
| Concurrent claim | SKIP LOCKED | Low |
| Worker dies mid-job | Stale lock release | Medium — up to lock timeout |
| Generation mismatch after stale release | `JobWorkerOwnershipError` | Handled for onboarding |
| Idempotency enqueue race | P2002 catch | Low |
| Shutdown during execution | Stale recovery | Medium — relies on trackInFlightJob fix |

---

## Recommendations

| Priority | Fix | Effort |
|----------|-----|--------|
| 🔴 Critical | Wire `trackInFlightJob` in worker execution loop | 1 day |
| 🔴 Critical | Complete offline worker orphan recovery | 2-3 days |
| 🟠 High | Expose dead-letter requeue in system-health UI | 2-3 days |
| 🟠 High | Replace fire-and-forget chaining with awaited enqueue + alerting | 2 days |
| 🟡 Medium | Allow re-enqueue with versioned idempotency keys for pipeline re-runs | 3 days |
| 🟡 Medium | Register cron workers or suppress false orphan alerts | 1 day |

**Expected reliability improvement:** Fixing shutdown + orphan recovery → 99.5%+ job completion rate under worker restarts.
