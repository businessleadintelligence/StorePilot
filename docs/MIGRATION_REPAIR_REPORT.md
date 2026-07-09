# StorePilot — Migration Dependency Repair Report

**Date:** 2026-06-20  
**Database:** Supabase `rbzhmuqduircqloqoepa` (Tokyo, empty → freshly migrated)  
**Scope:** Migration SQL only — no `schema.prisma`, application code, or test changes

---

## Summary

Repaired forward-reference violations in the Prisma migration chain so all **22 migrations** apply successfully on a brand-new empty PostgreSQL database. Migration folder names and count are unchanged (no squash, no baseline).

---

## Dependency Graph (Chronological)

```
20240530213853_create_session_table
  └─ Session

20250620120000_add_store_table
  └─ stores, SubscriptionPlan, SubscriptionStatus enums

20250620130000_add_users_table
  └─ users → stores

20260620120000_f614_high_elimination          [REPAIRED — was no-op placeholder]
  └─ (statements moved downstream)

20260620180000_f616_critical_elimination
  └─ stores.lastAuthenticatedAt, customer_data_exports → stores

20260620190000_f618_high_elimination          [REPAIRED — partial move]
  └─ stores.firstTrialStartedAt
  └─ sync_jobs / store_onboarding → moved to async_jobs_foundation

20260620220000_add_billing_foundation         [REPAIRED — receives subscriptions ALTER]
  └─ plans, subscriptions, usage_records → stores
  └─ + subscriptions.endedAt (from f614)

20260621055334_add_products_table
  └─ products → stores

20260621103524_add_inventory_item_foundation  [REPAIRED — receives webhook_events ALTER]
  └─ webhook_events → stores
  └─ + processingOwner, processingExpiresAt, processedAt nullable (from f614)

20260621120000_commercial_billing_plans
  └─ UPDATE/INSERT plans

20260621152544_add_orders_foundation
  └─ orders, order_line_items → stores

20260621225938_add_async_jobs_foundation      [REPAIRED — receives f618 job ALTERs]
  └─ sync_jobs, store_onboarding, job_events → stores
  └─ + workerGeneration, ownershipRepairPending (from f618)

20260622120000_add_product_shopify_updated_at
  └─ products.shopifyProductUpdatedAt

20260622140000_production_hardening
  └─ JobType.connector_sync, indexes on webhook_events, sync_jobs
      (depends on processingExpiresAt from f614 → now safe)

20260628120000_add_ai_platform_v2
  └─ AI enums + ai_* tables → stores

20260629120000_add_pricing_intelligence_agent
  └─ AIAgentId + pricing_intelligence

20260630120000_add_growth_intelligence_agent  [REPAIRED — was empty]
  └─ AIAgentId + growth_intelligence

20260701120000_add_executive_coo_agent        [REPAIRED — was empty]
  └─ AIAgentId + executive_coo

20260702120000_add_google_integration
  └─ google_integrations → stores, store_onboarding column

20260703120000_add_search_console_integration
  └─ google_integrations GSC columns

20260704120000_add_pagespeed_integration
  └─ google_integrations pageSpeedLastSyncAt

20260705120000_add_microsoft_clarity_integration
  └─ microsoft_clarity_integrations → stores
```

---

## Forward-Reference Violations Found

| Migration | Referenced object | Created by (later migration) |
|-----------|-------------------|------------------------------|
| `20260620120000_f614_high_elimination` | `subscriptions` | `20260620220000_add_billing_foundation` |
| `20260620120000_f614_high_elimination` | `webhook_events` | `20260621103524_add_inventory_item_foundation` |
| `20260620190000_f618_high_elimination` | `sync_jobs` | `20260621225938_add_async_jobs_foundation` |
| `20260620190000_f618_high_elimination` | `store_onboarding` | `20260621225938_add_async_jobs_foundation` |
| `20260630120000_add_growth_intelligence_agent` | `AIAgentId` enum value | empty file (value missing after `add_ai_platform_v2`) |
| `20260701120000_add_executive_coo_agent` | `AIAgentId` enum value | empty file (value missing after `add_ai_platform_v2`) |

---

## Repairs Applied

### 1. `20260620120000_f614_high_elimination`

**Reason:** ALTERed `subscriptions` and `webhook_events` before either table existed.

**Repair:** Replaced with documented no-op (`SELECT 1`). Statements moved to table-creation migrations below.

### 2. `20260620220000_add_billing_foundation`

**Reason:** `subscriptions` is created here; `endedAt` column must be added after CREATE TABLE.

**Repair:** Appended:
- `ALTER TABLE "subscriptions" ADD COLUMN "endedAt" TIMESTAMPTZ`
- `CREATE INDEX "subscriptions_ended_at_idx"`

### 3. `20260621103524_add_inventory_item_foundation`

**Reason:** `webhook_events` is created here; processing columns must be added after CREATE TABLE.

**Repair:** Appended:
- `processingOwner`, `processingExpiresAt` columns
- `processedAt` DROP NOT NULL / DROP DEFAULT

### 4. `20260620190000_f618_high_elimination`

**Reason:** ALTERed `sync_jobs` and `store_onboarding` before async jobs foundation.

**Repair:** Kept `stores.firstTrialStartedAt` only. Job/onboarding ALTERs moved to async jobs migration.

### 5. `20260621225938_add_async_jobs_foundation`

**Reason:** Target tables created here.

**Repair:** Appended:
- `sync_jobs.workerGeneration`
- `store_onboarding.ownershipRepairPending`

### 6. `20260630120000_add_growth_intelligence_agent`

**Reason:** Empty migration left `growth_intelligence` out of `AIAgentId` enum on fresh DB.

**Repair:** `ALTER TYPE "AIAgentId" ADD VALUE IF NOT EXISTS 'growth_intelligence'`

### 7. `20260701120000_add_executive_coo_agent`

**Reason:** Empty migration left `executive_coo` out of `AIAgentId` enum on fresh DB.

**Repair:** `ALTER TYPE "AIAgentId" ADD VALUE IF NOT EXISTS 'executive_coo'`

---

## Validation Results

| Check | Result |
|-------|--------|
| `npx prisma migrate reset --force` | **PASS** — all 22 migrations applied |
| `npx prisma migrate status` | **PASS** — database schema up to date |
| `npx prisma generate` | **PASS** (ran during reset) |
| `npx prisma validate` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm test` | **6 failures** (unrelated to migrations — see note) |

### Table existence (post-migration)

| Table | Exists |
|-------|--------|
| `stores` | ✓ |
| `users` | ✓ |
| `products` | ✓ |
| `orders` | ✓ |
| `subscriptions` | ✓ |
| `webhook_events` | ✓ |
| `google_integrations` | ✓ |
| `microsoft_clarity_integrations` | ✓ |

### Test note

6 failures in `privacy-by-architecture.test.ts` and `f614-high-elimination.test.ts` assert contents of `shopify.app.toml` (API version, scopes, webhooks). The current `shopify.app.toml` appears to be a Shopify CLI template snapshot and was **not modified** in this sprint per scope constraints. These failures are **not caused by migration repairs**.

---

## Confirmation

A brand-new empty Supabase PostgreSQL database can now be initialized by running:

```
npx prisma migrate deploy
```

(or `npx prisma migrate reset --force` on a development database)

All 22 migrations execute in order without `relation does not exist` errors. Final database shape matches `schema.prisma` for all repaired objects. No migrations were squashed, renamed, or baselined.
