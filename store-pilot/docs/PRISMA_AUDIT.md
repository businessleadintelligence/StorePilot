# Prisma Audit — StorePilot Production Database

**Date:** 2026-07-09  
**Scope:** `app/`, `packages/database/`, `prisma/`  
**Goal:** Identify scalability and resilience risks before AI Platform workloads  
**Mode:** Read-only audit + infrastructure remediation (no business logic changes)

---

## Executive summary

StorePilot uses a **single Prisma entry point** (`app/db.server.ts`) for application code. The primary production risk is **connection pool exhaustion on Vercel serverless** (observed during concurrent onboarding with pool limit 5), compounded by **N+1 write patterns** in catalog/order sync and **long multi-table transactions** during GDPR uninstall.

| Category | Severity | Count | Status after sprint |
|----------|----------|------:|---------------------|
| Duplicate app `PrismaClient` | Low | 0 in `app/` | ✅ Singleton hardened |
| Singleton violations (prod) | High | 1 (no global reuse) | ✅ Fixed |
| N+1 write patterns | High | 5+ hotspots | ⚠️ Documented; 1 batched |
| Long transactions | Medium | 3 high-risk | ⚠️ Documented |
| Missing retry layer | High | 1 | ✅ `packages/database/retry.ts` |
| Missing observability | High | 1 | ✅ Query/tx metrics |
| Index gaps | Low | 0 critical | ✅ Existing indexes adequate |

---

## 1. PrismaClient instantiation

### Application (`app/`)

| File | Pattern | Verdict |
|------|---------|---------|
| `app/db.server.ts` | Singleton via `getPrismaClient()` | ✅ Canonical |
| All other app files | `import prisma from "../db.server"` | ✅ Correct |

**Before sprint:** Production created a new `PrismaClient` per serverless isolate without `globalThis` reuse.

**After sprint:** `packages/database/client.ts` stores client on `globalThis.__storePilotPrismaClient__` for warm reuse across requests in the same isolate.

### Scripts / one-offs (acceptable)

| Location | Count |
|----------|------:|
| `scripts/*.mjs`, `scripts/*.mts` | 12 |
| `prisma/seed.ts` | 1 |
| `.tmp-*.mjs` | 4 |

Scripts correctly use standalone clients and `$disconnect()`. Not a production concern.

---

## 2. Singleton violations (fixed)

```typescript
// BEFORE — app/db.server.ts
if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = new PrismaClient();
}
const prisma = global.prismaGlobal ?? new PrismaClient();
```

Production never reused the client on warm lambdas. Each cold start + concurrent requests multiplied pool usage.

```typescript
// AFTER — packages/database/client.ts
globalThis.__storePilotPrismaClient__ ??= createInstrumentedPrismaClient();
```

---

## 3. Connection configuration

### Schema

```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  directUrl         = env("DIRECT_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

### Recommended production URL (Supabase transaction pooler)

```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=15
```

| Runtime | `connection_limit` | `pool_timeout` | Notes |
|---------|-------------------:|---------------:|-------|
| Vercel serverless | **1** | 15s | One connection per warm isolate |
| Background worker | **3** | 30s | Cron + webhook overlap |
| AI Platform workers | **2** | 20s | Short DB bursts; LLM off hot path |

**Observed incident:** Install at 2026-07-09 logged `Timed out fetching a new connection from the connection pool (connection limit: 5)` during concurrent `/app` requests.

---

## 4. N+1 query patterns

### Critical — write path

| File | Lines | Pattern | Impact |
|------|-------|---------|--------|
| `app/services/product.server.ts` | 959–973, 1447–1677 | `for (variant)` → `upsertVariantRow()` | 2+ queries × variant count during sync/webhooks |
| `app/services/orders.server.ts` | 1611–1614 | `for (lineItem)` → upsert inside `$transaction` | Per order, holds tx open |
| `app/services/orders.server.ts` | 2012–2021 | Sequential quarantined order retry | Medium |
| `app/ai/persistence/prisma-persistence.ts` | 252–310 | Sequential `aiRecommendation.upsert` | **Fixed:** batched ×5 with retry |
| `app/services/gdpr.server.ts` | 545–583 | Per-order customer redact updates | Scales with order count |

### Medium — orchestration loops

| File | Lines | Pattern |
|------|-------|---------|
| `app/services/job.server.ts` | 383–438 | `$transaction` per stale job in `releaseStaleJobs` |
| `app/services/onboarding.server.ts` | 520–573 | Reconcile loop triggers multiple DB ops per phase |

### Recommended future refactors (not in this sprint — business logic)

- Product sync: bulk `upsert` via `$transaction` + preloaded variant map
- Order webhooks: batch line items with `createMany` + targeted updates
- GDPR uninstall: staged deletes outside single long transaction

---

## 5. Sequential awaits batchable with `Promise.all`

| File | Lines | Opportunity |
|------|-------|-------------|
| `app/services/executive-dashboard.server.ts` | 1637–1679 | 5 sequential `aiAgentResult.findMany` → parallel |
| `app/services/billing.server.ts` | 204–225 | Independent reads before write |

**Already well-batched:** `metrics.server.ts`, `command-center.server.ts`, `founder-ops.server.ts`, `monitoring.server.ts`.

---

## 6. Transaction audit

| File | Function | Duration risk | Isolation | Recommendation |
|------|----------|---------------|-----------|----------------|
| `gdpr.server.ts` | Shop uninstall | **HIGH** — 19 deletes | Default | Split into batched deletes |
| `billing.server.ts` | AI credit debit | MEDIUM | Serializable | ✅ Already retries P2034 |
| `billing-enforcement.server.ts` | Limit checks | MEDIUM | Row locks | Keep short |
| `orders.server.ts` | Webhook upsert | MEDIUM | Default | Reduce in-tx loops |
| `product.server.ts` | Variant webhook | MEDIUM | Default | Batch variant writes |
| `onboarding.server.ts` | Phase advance | MEDIUM | Default | OK with tx timeout |
| `job.server.ts` | Claim/complete/fail | LOW | Default | OK |

**New infrastructure:** `withPrismaTransaction()` applies `maxWait: 10s`, `timeout: 30s`, and transient retry.

---

## 7. Heavy reads / includes

No deeply nested includes found. Concerns are **unbounded `findMany`** in fact builders:

| File | Risk |
|------|------|
| `trend-intelligence-facts.server.ts` | All active products + 90-day line items |
| `growth-intelligence-facts.server.ts` | All products + multi-window orders |
| `bundle-intelligence-facts.server.ts` | Products + line items |
| `executive-coo-facts.server.ts` | Multiple unbounded order/rec queries |
| `prisma-persistence.ts` | `aiRecommendation.findMany` without `take` |

AI agents should consume **pre-aggregated facts** (existing pattern) rather than raw table scans.

---

## 8. Index inventory

**47 `@@index` + 9 composite `@@unique`** — schema is well-indexed for current access patterns.

Key indexes for scale:

| Model | Index | Purpose |
|-------|-------|---------|
| `SyncJob` | `[status, availableAt, priority]` | Worker claim |
| `SyncJob` | `[status, lockExpiresAt]` | Stale lock release |
| `Order` | `[storeId, metricDate]` | Metrics aggregation |
| `OrderLineItem` | `[storeId, shopifyVariantId]` | Velocity / bundles |
| `AiAgentRun` | `[storeId, agentId, inputFingerprint]` | Cache lookup |
| `AiRecommendation` | `[storeId, stableId]` | Upsert target |

**No new indexes required** for this sprint. Re-evaluate after AI write volume exceeds 10K recommendations/store.

---

## 9. Retry logic (before / after)

| Location | Before | After |
|----------|--------|-------|
| `billing.server.ts` | P2034 only (AI credits) | Unchanged |
| Global | None | `withPrismaRetry()` — P1001, P1008, P1017, P2024, P2034 |
| Non-retryable | Ad hoc P2002 handling | Centralized: P2002, P2003, validation |

---

## 10. Observability (before / after)

| Capability | Before | After |
|------------|--------|-------|
| DB health probe | `SELECT 1` latency | ✅ + metrics snapshot |
| Query duration | None | ✅ `$extends` middleware |
| Slow query log | None | ✅ >250ms → `[db-slow-query]` |
| Transaction duration | None | ✅ `withPrismaTransaction` |
| Retry count | None | ✅ `recordDatabaseRetry()` |
| Pool utilization | None | ✅ Peak active / configured limit |
| `/health/monitor` | Basic | ✅ Includes `metrics` + `poolAudit` |

---

## 11. Files changed in this sprint

| Path | Change |
|------|--------|
| `packages/database/retry.ts` | Transient retry helper |
| `packages/database/metrics.ts` | Query/tx/retry metrics |
| `packages/database/client.ts` | Instrumented singleton |
| `packages/database/batch.ts` | Parallel batch utility |
| `packages/database/pool-config.ts` | URL audit + recommendations |
| `packages/database/transaction.ts` | Retry-safe transaction wrapper |
| `packages/database/index.ts` | Public exports |
| `app/db.server.ts` | Re-exports infrastructure |
| `app/services/monitoring.server.ts` | Metrics in health check |
| `app/ai/persistence/prisma-persistence.ts` | Batched recommendation upserts |
| `.env.example` | `DIRECT_URL` + pool params documented |
| `app/services/__tests__/database-retry.test.ts` | Retry unit tests |

---

## 12. Remaining risks

1. **Product/order N+1 writes** — largest throughput bottleneck at scale
2. **GDPR uninstall mega-transaction** — lock duration under large stores
3. **`connection_limit=5` in production Vercel env** — must reduce to **1** for serverless
4. **Fact builder unbounded reads** — memory pressure when AI agents run concurrently
5. **`releaseStaleJobs` per-job transactions** — cron storm under failure mode

---

## References

- `packages/database/` — infrastructure layer
- `docs/DATABASE_SCALABILITY_REPORT.md` — capacity planning + AI readiness
- `docs/PRODUCTION_INSTALLATION_VERIFICATION.md` — pool timeout incident
