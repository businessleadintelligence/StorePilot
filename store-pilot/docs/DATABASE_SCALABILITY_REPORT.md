# Database Scalability Report — StorePilot

**Date:** 2026-07-09  
**Sprint:** Production Database Scalability (pre-AI Platform)  
**Validation:** ✅ typecheck · ✅ 2,871 tests · ✅ build · ✅ prisma validate · ✅ prisma generate

---

## Executive summary

StorePilot's database layer has been hardened for production serverless workloads. A new `packages/database/` infrastructure layer provides **singleton client reuse**, **transient retry**, **query observability**, and **pool configuration guidance**.

| Metric | Before | After |
|--------|--------|-------|
| Performance score | 62/100 | **78/100** |
| Connection health | Degraded (pool timeout observed) | **Improved** (infra ready; env update required) |
| Retry coverage | Billing P2034 only | **Global transient helper** |
| Observability | `SELECT 1` only | **Full query/tx/retry metrics** |
| Ready for AI Platform? | **No** | **Conditional yes** (see §8) |

---

## 1. Performance score: **78 / 100**

| Area | Weight | Score | Notes |
|------|-------:|------:|-------|
| Connection management | 20% | 16/20 | Singleton + pool audit; Vercel env still needs `connection_limit=1` |
| Query efficiency | 25% | 16/25 | N+1 in product/order sync remains |
| Transaction hygiene | 15% | 11/15 | Timeouts added; GDPR tx still long |
| Resilience / retry | 15% | 14/15 | `withPrismaRetry` implemented |
| Observability | 10% | 9/10 | Metrics in `/health/monitor`; no external APM yet |
| Index coverage | 10% | 10/10 | Comprehensive existing indexes |
| AI read/write patterns | 5% | 2/5 | Recommendation batching done; fact reads unbounded |

**+16 points** from infrastructure sprint. Remaining **22 points** require business-path batch refactors and production env tuning.

---

## 2. Connection health

### Incident (2026-07-09 install)

```
PrismaClientInitializationError: Timed out fetching a new connection from the connection pool
(connection pool timeout: 10, connection limit: 5)
```

Two concurrent authenticated `/app` requests during OAuth onboarding exhausted the pool.

### Root cause

| Factor | Detail |
|--------|--------|
| Serverless concurrency | Multiple warm requests in one Vercel isolate |
| Pool limit | `connection_limit=5` too high per isolate × many isolates |
| No global reuse | Production did not cache PrismaClient on `globalThis` |
| afterAuth burst | Store upsert + webhook register + onboarding enqueue in parallel |

### Remediation implemented

| Change | File |
|--------|------|
| Global singleton across warm invocations | `packages/database/client.ts` |
| Pool URL audit + warnings | `packages/database/pool-config.ts` |
| Graceful `$disconnect` on SIGTERM | `packages/database/client.ts` |
| Metrics: connection wait, pool utilization | `packages/database/metrics.ts` |

### Required production env change (manual)

Update Vercel `DATABASE_URL` to include:

```
?pgbouncer=true&connection_limit=1&pool_timeout=15
```

Ensure `DIRECT_URL` uses port **5432** (non-pooler) for migrations only.

---

## 3. Infrastructure delivered

### `packages/database/`

| Module | Purpose |
|--------|---------|
| `retry.ts` | 3-attempt exponential backoff + jitter; P1001/P1008/P1017/P2024/P2034 |
| `metrics.ts` | Query duration, slow query log, tx duration, retry count, pool estimate |
| `client.ts` | Instrumented `$extends` singleton |
| `batch.ts` | `runInParallelBatches(items, size, worker)` |
| `pool-config.ts` | URL audit + runtime recommendations |
| `transaction.ts` | `withPrismaTransaction(label, fn)` with timeout + retry |

### Integration points

| Consumer | Usage |
|----------|-------|
| `app/db.server.ts` | Re-exports all infrastructure |
| `app/services/monitoring.server.ts` | Metrics in `checkDatabaseHealth` |
| `app/ai/persistence/prisma-persistence.ts` | Batched upserts (5-wide) + retry |

---

## 4. Retry strategy

```typescript
import { withPrismaRetry } from "../db.server";

await withPrismaRetry(() => prisma.store.findUnique({ ... }), {
  label: "store.lookup",
  maxAttempts: 3,
});
```

| Retries | Backoff | Jitter |
|---------|---------|--------|
| 3 | 100ms → 200ms → 400ms (capped 2s) | +0–25% |

**Never retries:** P2002 (unique), P2003 (FK), `PrismaClientValidationError`.

---

## 5. Request batching

| Path | Before | After |
|------|--------|-------|
| `aiRecommendation.upsertMany` | Sequential loop | **5-parallel batches + retry** |
| Product variant sync | Sequential per variant | ⚠️ Future sprint |
| Order line items | Sequential in tx | ⚠️ Future sprint |
| Executive dashboard reads | 5 sequential finds | ⚠️ `Promise.all` opportunity |

Utility: `runInParallelBatches(items, batchSize, worker)` — use for future batch refactors.

---

## 6. Transaction review summary

| Risk level | Count | Action |
|------------|------:|--------|
| HIGH | 1 | GDPR uninstall — staged delete (future) |
| MEDIUM | 6 | Timeouts enforced via `withPrismaTransaction` |
| LOW | 10+ | Job queue txs — acceptable |

Default transaction limits: `maxWait: 10s`, `timeout: 30s`.

---

## 7. Query optimization / indexes

**No new migrations required.** Existing 47 indexes cover:

- Worker job claiming (`sync_jobs_claim_idx`)
- Order metrics (`orders_store_metric_date_idx`)
- AI cache lookup (`ai_agent_results_cache_lookup_idx`)
- Recommendation upsert (`ai_recommendations_store_stable_unique`)

Re-audit when any table exceeds **500K rows/store**.

---

## 8. AI Platform readiness

### Estimated concurrent load per agent family

| Agent / subsystem | Peak DB reads | Peak DB writes | Hold time | Strategy |
|-------------------|-------------:|---------------:|----------:|----------|
| Historical Learning | 50–200 | 5–20 | 2–5s | Batch fact reads; enqueue writes |
| Knowledge Graph | 100–500 | 10–50 | 5–15s | Pre-aggregate; cache in `AiAgentResult` |
| Executive COO | 200–800 | 20–100 | 10–30s | Parallel `Promise.all` reads; batch rec upserts |
| Experiment Engine | 20–100 | 10–30 | 1–3s | Short txs; idempotent keys |
| Prediction Engine | 100–300 | 5–15 | 3–8s | Read facts once; write scores batch |
| Cross-System Analysis | 300–1000 | 30–80 | 15–45s | **Must run in worker**, not HTTP request |

### Recommended operating parameters

| Parameter | Vercel HTTP | Worker cron | AI worker (future) |
|-----------|------------:|------------:|-------------------:|
| `connection_limit` | 1 | 3 | 2 |
| Worker concurrency | N/A | 1 job/invoke | 2–3 parallel jobs |
| Queue batch size | N/A | 3 (current) | 5 for AI jobs |
| Recommendation upsert batch | N/A | N/A | 5–10 |
| Max concurrent agents/store | 1 | 2 | 3 (queued) |

### Estimated concurrent merchant capacity

Assumptions: Supabase Pro (200 direct / pooler connections), `connection_limit=1` per Vercel isolate, avg 2 isolates/store at peak.

| Plan | Pool connections | Est. concurrent active stores | Bottleneck |
|------|-----------------:|------------------------------:|------------|
| Supabase Free | ~15–20 | **5–8** | Pool size |
| Supabase Pro | ~200 | **80–120** | Worker throughput |
| Supabase Team | ~400+ | **200+** | N+1 write paths |

**Current production (post-install):** 1 store, 1 session, 1 queued job — well within limits.

---

## 9. Observability

### Metrics exposed via `/health/monitor` → `database.details.metrics`

| Metric | Description |
|--------|-------------|
| `queryCount` | Total instrumented queries |
| `slowQueryCount` | Queries ≥250ms |
| `retryCount` | Transient retry attempts |
| `transactionCount` | Wrapped transactions |
| `averageQueryDurationMs` | Rolling average |
| `p95QueryDurationMs` | Rolling P95 |
| `poolUtilizationEstimate` | Peak active / configured limit |
| `recentSlowQueries` | Last 20 slow queries |
| `connectionWaitMs` | Cumulative wait time |

### Log tags

| Tag | Trigger |
|-----|---------|
| `[db-slow-query]` | Query ≥250ms |
| `[db-slow-transaction]` | Transaction ≥500ms |
| `[db-pool-config]` | Startup URL warnings |

### Optional: enable query logging locally

```
PRISMA_LOG_QUERIES=1
```

---

## 10. Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Production `connection_limit=5` | **HIGH** | Update Vercel env to `1` |
| Product/order N+1 writes | **HIGH** | Dedicated sync optimization sprint |
| GDPR mega-transaction | MEDIUM | Staged delete pattern |
| Unbounded fact reads for AI | MEDIUM | Add `take` limits + pagination |
| No external APM (Datadog/Sentry) | MEDIUM | Add before AI launch |
| `prisma/migrations` missing on Vercel bundle | LOW | Readiness check ENOENT — bundle migrations or remove fs check |

---

## 11. Recommended Supabase plan

| Stage | Plan | Rationale |
|-------|------|-----------|
| **Now** (pre-launch, ≤10 stores) | **Pro** ($25/mo) | 200 pool connections, daily backups, ap-northeast-1 |
| Growth (50–200 stores) | **Pro** + read replicas if needed | Monitor pool saturation via metrics |
| AI Platform GA (200+ stores) | **Team** | Higher connection limits, priority support |

---

## 12. Recommended Vercel limits

| Setting | Value |
|---------|-------|
| Root Directory | `store-pilot` |
| Node.js | 22.x |
| Function max duration | 60s (Pro) for worker routes |
| `CRON_JOB_BATCH_SIZE` | 3 (default); increase to 5 after pool fix |
| Concurrent isolates | Monitor via Vercel dashboard; pool limit=1 contains blast radius |
| Env: `DATABASE_URL` | Pooler :6543 + `connection_limit=1` |
| Env: `DIRECT_URL` | Direct :5432 |

---

## 13. Ready for AI Platform?

### Verdict: **Conditional yes**

| Gate | Status |
|------|--------|
| Singleton client | ✅ |
| Transient retry | ✅ |
| Query observability | ✅ |
| Recommendation batch writes | ✅ |
| Production pool config | ⚠️ **Manual env update required** |
| Product/order N+1 resolved | ❌ Defer to sync sprint |
| AI agents run in worker queue | ✅ Architecture supports (existing `SyncJob`) |
| External APM | ❌ Recommended before GA |

**Proceed with AI Platform implementation** once:

1. Vercel `DATABASE_URL` updated to `connection_limit=1`
2. Install verified under concurrent dashboard load (no pool timeouts in logs)
3. AI agent runs constrained to worker queue (not synchronous HTTP)

---

## 14. Validation results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ Pass |
| `npm test` | ✅ 2,871 / 2,871 |
| `npm run build` | ✅ Pass |
| `npx prisma validate` | ✅ Pass |
| `npx prisma generate` | ✅ Pass |

---

## References

- [PRISMA_AUDIT.md](./PRISMA_AUDIT.md) — detailed findings
- [PRODUCTION_INSTALLATION_VERIFICATION.md](./PRODUCTION_INSTALLATION_VERIFICATION.md) — pool timeout incident
- `packages/database/` — implementation
