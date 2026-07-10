# Raw SQL Audit — P0 Stabilization

**Generated:** 2026-07-11  
**Scope:** All `store_id` references and application `$queryRaw` / `$executeRaw` usage

---

## Executive finding

**One verified production bug:** `app/services/billing-enforcement.server.ts` used `store_id` (snake_case) against the `subscriptions` table, which defines the column as **`"storeId"`** (Prisma camelCase). PostgreSQL error:

```
column "store_id" does not exist
```

**Status:** **FIXED** in this sprint (`"storeId"` quoted identifier).

---

## Application raw queries (production code)

| File | Function | SQL summary | Column refs | Status |
|------|----------|-------------|-------------|--------|
| `billing-enforcement.server.ts` | `lockStoreForBilling` | `SELECT id FROM stores WHERE id = $1 FOR UPDATE` | `stores.id` | ✅ Correct |
| `billing-enforcement.server.ts` | `lockSubscriptionForBilling` | `SELECT id FROM subscriptions WHERE "storeId" = $1 FOR UPDATE` | `"storeId"` | ✅ **Fixed** (was `store_id`) |
| `billing.server.ts` | `tryIncrementAiCreditsWithinLimit` | `SELECT ... FROM usage_records WHERE "storeId" = ...` | `"storeId"` | ✅ Correct |
| `job.server.ts` | `claimNextJob` | CTE on `sync_jobs` with quoted camelCase cols | `"availableAt"`, `"JobStatus"`, etc. | ✅ Correct |
| `job.server.ts` | `getExtendedJobQueueMetrics` | Aggregations on `sync_jobs` | Quoted identifiers | ✅ Correct |
| `monitoring.server.ts` | health probe | `SELECT 1 as ok` | N/A | ✅ Correct |
| `startup-readiness.server.ts` | migration check | `_prisma_migrations` | Standard | ✅ Correct |
| `worker-metrics.server.ts` | queue metrics | `sync_jobs` aggregates | `"startedAt"`, `"createdAt"`, `"durationMs"` | ✅ Correct |
| `production-sync-monitor.ts` | DB probe | `SELECT 1` | N/A | ✅ Correct |

---

## Verified fix detail

### Before (WRONG)

```sql
SELECT id FROM subscriptions WHERE store_id = $1::uuid FOR UPDATE
```

### After (CORRECT)

```sql
SELECT id FROM subscriptions WHERE "storeId" = $1::uuid FOR UPDATE
```

### Why it was wrong

Prisma schema (`Subscription.storeId`) maps to PostgreSQL column **`"storeId"`**, not `store_id`. Index map names like `users_store_id_idx` are **index names only** — not column names.

Migration evidence: `prisma/migrations/20260620220000_add_billing_foundation/migration.sql` creates `"storeId" UUID NOT NULL`.

### Files modified

| File | Change |
|------|--------|
| `app/services/billing-enforcement.server.ts` | Line 63: `store_id` → `"storeId"` |
| `app/services/__tests__/billing-enforcement-raw-sql.test.ts` | Regression test |

---

## Docs / scripts (non-runtime)

| Location | `store_id` usage | Action |
|----------|------------------|--------|
| `docs/manual-validation/*.md` | Placeholder `<store_id>` in SQL examples | Documentation only — examples use correct `"storeId"` in queries |
| `scripts/f39-backfill-audit.mjs` | Alias `AS store_id` in SELECT | ✅ Read-only audit script |
| `prisma/migrations/*` | Index names `*_store_id_idx` | ✅ Index names, columns are `"storeId"` |
| `operations-validator.ts` | Error code string `missing_store_id` | ✅ Not SQL |

---

## Migrations audit

`20260710160000_p0_query_performance_indexes` — uses quoted `"storeId"`, `"currentJobId"`, `"createdAt"`. **RESOLVED** (previously failed with snake_case).

No remaining migration files use incorrect column names for live tables.

---

## Regression test

`app/services/__tests__/billing-enforcement-raw-sql.test.ts` asserts subscription lock SQL contains `"storeId"` and not `store_id`.
