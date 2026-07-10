# Environment Verification — Phase C.1

**Date:** 2026-07-10  
**Method:** `vercel env ls production` (names only — **values not inspected**)

---

## Production Variables

| Variable | Status | Notes |
|----------|--------|-------|
| DATABASE_URL | ✅ Present | DB queries succeeded locally via .env |
| DIRECT_URL | ✅ Present | Monitor: directUrlConfigured=true |
| OPENAI_API_KEY | ✅ Present | AI probe healthy |
| AI_PROVIDER | ✅ Present | |
| AI_MODEL | ✅ Present | gpt-4o-mini in monitor |
| TOKEN_ENCRYPTION_KEY | ✅ Present | Roundtrip check passes |
| CRON_SECRET | ✅ Present | cronSecretConfigured=true |
| SHOPIFY_API_KEY | ✅ Present | |
| SHOPIFY_API_SECRET | ✅ Present | |
| SHOPIFY_APP_URL | ✅ Present | Matches shopify.app.toml |
| SCOPES | ✅ Present | Matches minimum scopes |
| AI_PLATFORM_ENABLED | ❌ **Missing** | COO AI path disabled in code |
| SESSION_SECRET | ❌ Missing | **Not used** — Shopify session via Prisma Session table |
| BILLING_TEST_MODE | ❌ Not listed | Assume unset (good for prod) |
| ANTHROPIC_API_KEY | ❌ Missing | Optional |
| GOOGLE_CLIENT_ID | ❌ Missing | Optional — GA4 disabled |
| GOOGLE_CLIENT_SECRET | ❌ Missing | Optional |
| NODE_ENV | ⚠️ Implicit | Vercel sets production automatically |
| WORKER_POLL_INTERVAL_MS | ❌ Missing | Uses defaults |
| WORKER_HEARTBEAT_INTERVAL_MS | ❌ Missing | Defaults |
| JOB_LOCK_DURATION_MS | ❌ Missing | Defaults |
| WORKER_BATCH_SIZE | ❌ Missing | Defaults |
| CRON_JOB_BATCH_SIZE | ❌ Missing | Defaults |
| AI_TIER_* routing | ❌ Missing | Code defaults |
| AI_STRUCTURED_OUTPUT_ENABLED | ❌ Missing | Optional |

---

## Incorrect / Deprecated

| Item | Issue |
|------|-------|
| DATABASE_URL pool params | Missing `connection_limit` / `pool_timeout` — monitor warnings |
| Three cron manifests | Deprecated pattern — use single canonical schedule |

---

## Unused in Production (Optional)

- `ANTHROPIC_*`, `GOOGLE_*`, worker tuning vars, AI tier overrides

---

## Verification Summary

| Category | Result |
|----------|--------|
| Core Shopify + DB + security | ✅ Complete |
| AI minimum | ✅ Present |
| AI full platform | ❌ AI_PLATFORM_ENABLED missing |
| Worker tuning | ⚠️ Defaults only |

---

## Issue E-1: AI_PLATFORM_ENABLED Missing

| Field | Value |
|-------|-------|
| Severity | Medium |
| Location | Vercel production env |
| Evidence | `vercel env ls` — not listed; `coo-service.ts` checks `=== "true"` |
| Impact | Executive COO AI disabled |
| Fix | Add `AI_PLATFORM_ENABLED=true` when AI launch intended |
| Verification | COO generates AI sections |
