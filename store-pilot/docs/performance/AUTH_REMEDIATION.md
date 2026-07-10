# Auth Remediation — P0 Sprint

**Date:** 2026-07-10

---

## Problem

OAuth callback (`afterAuth`) blocked merchants on:

- Billing subscription creation
- Onboarding row creation + phase advancement
- Store backfill
- Orders scheduler
- **Inline** `bootstrapIntelligenceAfterAuth` (Shopify GraphQL + DB writes)

This caused Vercel function timeouts, pool exhaustion, and `Unexpected Server Error` after iframe OAuth failures.

---

## Solution

### Minimal synchronous `afterAuth` (`app/shopify.server.ts`)

Only:

1. `upsertStoreFromSession` — minimum store record
2. `registerWebhooks` — best-effort (errors logged, non-blocking)
3. `schedulePostAuthBootstrapJob` — enqueue `JobType.onboarding_bootstrap`

Session persistence is handled by Shopify SDK before `afterAuth` runs.

### Background bootstrap (`app/services/after-auth-bootstrap.server.ts`)

Worker executes `JobType.onboarding_bootstrap`:

- `upsertOwnerFromSession`
- `ensureSubscriptionForActiveStore`
- `getOrCreateStoreOnboarding`
- `ensureStoreBackfillAfterReinstall`
- `ensureOrdersSchedulerActive`
- `scheduleLearningBootstrapJob` (replaces inline GraphQL bootstrap)
- `advanceOnboarding`

### Worker handler (`app/services/worker.server.ts`)

New case: `JobType.onboarding_bootstrap` → `runPostAuthBootstrap`

Uses existing `unauthenticated.admin(shop)` pattern for Shopify API access.

---

## Auth hardening

| Issue | Fix |
|-------|-----|
| Double `authenticate.admin` per dashboard request | `authenticateAdminOnce` WeakMap cache (`app/lib/request-auth.server.ts`) |
| Parent + child both auth | Index loader uses cached auth; parent `app.tsx` owns primary auth |
| OAuth iframe trap | Unchanged SDK behavior; faster callback reduces retry loops |
| Expired session recovery | Standard Shopify re-auth; no blocking work on callback |

---

## Flow diagram

```
Merchant click
  → /app (authenticateAdminOnce)
  → [no session] OAuth top-level redirect (App Bridge)
  → /auth/callback
  → afterAuth: store + webhooks + enqueue onboarding_bootstrap
  → redirect /app (immediate)
  → Dashboard shell renders
  → Cron worker: onboarding_bootstrap → onboarding + learning_bootstrap jobs
```

---

## Verification status

| Scenario | Status |
|----------|--------|
| Unit: enqueue idempotency | ✅ `after-auth-bootstrap.test.ts` |
| Unit: f618 webhook failure non-blocking | ✅ Source contract test |
| Fresh install (live) | 🟡 Requires MV-1 on production |
| Reinstall | 🟡 Requires manual validation |
| Expired session / incognito | 🟡 Requires manual validation |
| OAuth retry / interrupted callback | 🟡 Requires manual validation |

---

## Files changed

- `app/shopify.server.ts` — slim afterAuth
- `app/services/after-auth-bootstrap.server.ts` — **new**
- `app/services/worker.server.ts` — onboarding_bootstrap handler
- `app/lib/request-auth.server.ts` — **new**
- `app/routes/app.tsx` — uses authenticateAdminOnce
