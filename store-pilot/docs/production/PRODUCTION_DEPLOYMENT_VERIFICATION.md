# StorePilot Phase C — Production Deployment Verification

**Date:** 2026-07-10  
**Production URL:** https://store-pilot-eta.vercel.app  
**Shopify App:** StorePilot (`storepilot-14`, client ID `c2e45ad18cb75c60ff489050150d9bc1`)  
**Mode:** Evidence-based validation only — no feature or architecture changes in this phase.

---

## Executive Summary

| Area | Status | Score (0–100) |
|------|--------|---------------|
| Production Deployment | **Partial** | 62 |
| End-to-End Install | **Blocked** | 18 |
| Worker | **Failed** | 22 |
| Webhooks | **Partial** | 58 |
| Onboarding | **Failed** | 25 |
| Dashboard | **Partial** | 72 |
| Billing | **Pass (code)** / **Unverified (prod DB)** | 78 |
| AI | **Partial** | 65 |
| Privacy | **Pass (architecture)** / **Unverified (prod runtime)** | 80 |
| Infrastructure | **Partial** | 55 |
| Monitoring | **Partial** | 60 |
| **Overall Launch Readiness** | **NOT READY** | **48** |

**Verdict:** StorePilot **cannot** currently onboard a new Shopify merchant to a fully operational state without developer intervention. The primary blockers are **no active background worker**, **worker cron throttled to once daily on Vercel Hobby**, and **onboarding progress stuck at 33%** when bootstrap jobs remain queued.

See [LAUNCH_READINESS_SCORECARD.md](./LAUNCH_READINESS_SCORECARD.md) for full scoring rationale.

---

## Part 1 — Production Deployment Audit

### Vercel

| Check | Result | Evidence |
|-------|--------|----------|
| App reachable | ✅ Pass | `GET /health` → 200, `{"ok":true,"mode":"liveness"}` (2026-07-10T00:50:09Z) |
| Readiness | ❌ Fail | `GET /health/ready` → 503 |
| Build/deploy | ✅ Pass | `/api/pricing` returns unified plan registry JSON (200) |
| Crons configured | ⚠️ Partial | `vercel.json` — 5 crons only; worker at `0 1 * * *` (daily 1 AM UTC) |
| Security headers | ✅ Pass | HSTS, nosniff, referrer-policy in `vercel.json` |
| Prompt bundling | ❌ Fail | Readiness: `missing_prompts:ExecutiveBriefing,...` (13 prompts) |

**Readiness failures (live production, 2026-07-10):**

```json
{
  "shopify_scope_drift": "env_not_in_toml:read_products,read_inventory,write_products,read_orders",
  "migrations": "ENOENT: no such file or directory, scandir '/var/task/prisma/migrations'",
  "foundation_prompt_registry": "missing_prompts:ExecutiveBriefing,DailyOperatingPlan,..."
}
```

### Railway Worker

| Check | Result | Evidence |
|-------|--------|----------|
| Worker deployed | ❌ **Not verified / likely absent** | `GET /health/worker` → `activeWorkers: 0`, alert `no_active_workers` |
| Dockerfile.worker | ✅ Present | `Dockerfile.worker` → `CMD ["npm", "run", "worker"]` |
| Railway IaC | ❌ Missing | No `railway.toml` in repo |
| Worker registration | ❌ None | `"workers": []` in health/worker response |

### Prisma / Supabase

| Check | Result | Evidence |
|-------|--------|----------|
| DATABASE_URL | ✅ Present (Vercel prod) | `vercel env ls production` |
| DIRECT_URL | ✅ Present | Same |
| DB connectivity | ✅ Pass | Monitor: `database` healthy, latency ~752ms |
| Supabase pooler | ⚠️ Degraded config | Monitor: `connection_limit` and `pool_timeout` query params missing |
| Migrations on serverless | ⚠️ False negative | Migrations dir absent from `/var/task`; DB-only fallback exists in code but readiness still fails when dir missing and applied set check path differs |

### Environment Variables (Production)

**Source:** `vercel env ls production` (2026-07-10), `.env.example`, codebase grep.

| Variable | Status | Notes |
|----------|--------|-------|
| SHOPIFY_API_KEY | ✅ Present | |
| SHOPIFY_API_SECRET | ✅ Present | |
| SHOPIFY_APP_URL | ✅ Present | Matches `shopify.app.toml` |
| SCOPES | ✅ Present | Matches minimum required scopes |
| DATABASE_URL | ✅ Present | |
| DIRECT_URL | ✅ Present | |
| TOKEN_ENCRYPTION_KEY | ✅ Present | Roundtrip check passes in readiness |
| CRON_SECRET | ✅ Present | Cron auth configured |
| OPENAI_API_KEY | ✅ Present | AI probe healthy |
| AI_PROVIDER | ✅ Present | openai |
| AI_MODEL | ✅ Present | gpt-4o-mini |
| NODE_ENV | ⚠️ Implicit | Auto-set by Vercel (not listed explicitly) |
| AI_PLATFORM_ENABLED | ❌ **Missing** | Required for Executive COO AI path (`coo-service.ts`) |
| ANTHROPIC_API_KEY | ❌ Missing | Optional unless Anthropic routing used |
| BILLING_TEST_MODE | ❌ Not listed | Should be unset/0 in production |
| GOOGLE_CLIENT_ID/SECRET | ❌ Missing | Optional — GA4/GSC disabled |
| WORKER_* tuning vars | ❌ Missing | Defaults apply |
| AI tier routing vars | ❌ Missing | Defaults in code |

**Unused / duplicate sources of truth:**
- Three cron schedules: `vercel.json`, `vercel.pro.crons.json`, `cron-scheduler.server.ts`
- Legacy `plan-config.ts` wraps `plan-registry.ts` (intentional compat layer)

**Incorrect / misleading checks:**
- `shopify_scope_drift` fails on Vercel because `shopify.app.toml` is not bundled at `/var/task` — **false positive**, scopes are aligned in repo

### Shopify App Configuration

| Setting | Expected | Actual |
|---------|----------|--------|
| application_url | production URL | ✅ `https://store-pilot-eta.vercel.app` |
| redirect_urls | `/auth/callback` | ✅ Matches |
| embedded | true | ✅ |
| scopes | 4 minimum | ✅ `read_products,read_inventory,write_products,read_orders` |
| webhook API version | 2025-10 | ✅ |

### Cron Jobs

| Job | Code schedule | Deployed (`vercel.json`) | Gap |
|-----|---------------|--------------------------|-----|
| worker | `*/2 * * * *` | `0 1 * * *` | **Critical** — 720× slower |
| retry-queue | `*/5 * * * *` | Not deployed | Stale lock recovery delayed |
| expired-sessions | hourly | Not deployed | |
| cleanup-jobs | daily 2 AM | ✅ | |
| knowledge-refresh | daily 3 AM | ✅ | |
| learning-engine | daily 4 AM | ✅ | |
| daily-operating-plan | daily 6 AM | ✅ | |
| recommendation-refresh | 7 AM, 7 PM | Not deployed | |
| scope-drift-monitor | daily 8 AM | Not deployed | |
| metrics-aggregation | every 6h | Not deployed | |
| privacy-pii-scan | daily 1 AM | Not deployed | |
| token-migration | daily 5 AM | Not deployed | |

---

## Critical Issues (Cross-Cutting)

### C-1: No Active Worker — Install Pipeline Blocked

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Location** | Production infra; `app/services/worker-runtime.server.ts`, Railway/Vercel cron |
| **Root Cause** | No continuous worker process registered; Vercel cron worker runs once daily |
| **Evidence** | `GET /health/worker` → `activeWorkers: 0`, `alerts: ["no_active_workers"]`; `docs/BOOTSTRAP_SYNC_AUDIT.md` — bootstrap job queued, 0 products |
| **Risk** | Every new install stuck at 33%; intelligence pipeline never runs |
| **Recommended Fix** | Deploy Railway worker OR upgrade Vercel Pro + apply `vercel.pro.crons.json`; verify `activeWorkers >= 1` |
| **Estimated Fix Time** | 2–4 hours |
| **Owner** | DevOps / Platform |
| **Verification** | `GET /health/worker` healthy; new install reaches 100% without manual cron |

### C-2: Onboarding Progress Misleading at 33%

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Location** | `app/services/onboarding.server.ts` — `enqueueAndLinkPhaseJob` |
| **Root Cause** | Progress set at job **enqueue**, not job **claim/start** |
| **Evidence** | `PHASE_CONFIG.PRODUCTS.progressPercent = 33`; bootstrap audit shows `productSyncStatus: running` while job `queued` |
| **Risk** | Merchants see "Syncing products" while worker idle |
| **Recommended Fix** | Deploy worker (immediate); optionally split "queued" vs "running" in UI |
| **Estimated Fix Time** | 4h worker + 4h UX (optional) |
| **Owner** | Platform + Frontend |
| **Verification** | Progress advances only after `claimNextJob` marks phase started |

### C-3: Readiness Endpoint Fails — False Alarms + Real Prompt Gap

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Location** | `startup-readiness.server.ts`, Vercel bundle |
| **Root Cause** | `shopify.app.toml` and `prisma/migrations` not in serverless bundle; prompt copy may not land in runtime path |
| **Evidence** | Live `/health/ready` 503 with three failed checks |
| **Risk** | Monitoring/Shopify review tools report unhealthy; AI jobs fail at runtime |
| **Recommended Fix** | Bundle toml for scope check OR env-only drift check on Vercel; ensure `copy-vercel-prompts.mjs` output path matches `validateFoundationPromptRegistry` cwd |
| **Estimated Fix Time** | 4–8 hours |
| **Owner** | Platform |
| **Verification** | `/health/ready` → 200 on production |

---

## Related Documents

| Document | Scope |
|----------|-------|
| [ONBOARDING_VALIDATION.md](./ONBOARDING_VALIDATION.md) | Progress milestones, 33% symptom |
| [WORKER_VALIDATION.md](./WORKER_VALIDATION.md) | Queue, heartbeat, job types |
| [WEBHOOK_VALIDATION.md](./WEBHOOK_VALIDATION.md) | All webhooks, app/uninstalled |
| [BILLING_VALIDATION.md](./BILLING_VALIDATION.md) | Plan registry SSOT |
| [AI_VALIDATION.md](./AI_VALIDATION.md) | Foundation, prompts, routing |
| [DASHBOARD_VALIDATION.md](./DASHBOARD_VALIDATION.md) | Widgets, links, states |
| [INFRASTRUCTURE_VALIDATION.md](./INFRASTRUCTURE_VALIDATION.md) | Latency, bundle, cold start |
| [MONITORING_VALIDATION.md](./MONITORING_VALIDATION.md) | Alerts, gaps |
| [SHOPIFY_SUBMISSION_CHECKLIST.md](./SHOPIFY_SUBMISSION_CHECKLIST.md) | App Store gates |
| [LAUNCH_READINESS_SCORECARD.md](./LAUNCH_READINESS_SCORECARD.md) | Final scores |

---

## Verification Methods Used

- Live HTTP probes to production endpoints (health, pricing, monitor, worker)
- Vercel CLI `env ls production` (names only, no secret values)
- Codebase static analysis (routes, services, schema, tests)
- Prior production DB audit (`docs/BOOTSTRAP_SYNC_AUDIT.md`)
- Full test suite: **3033 tests passed** (280 files, 2026-07-10)

## Not Verified (Requires Merchant / Shopify Partner Action)

- Full OAuth install on a **brand-new** dev store (no automated run in this phase)
- Live webhook delivery logs in Shopify Partner Dashboard
- Railway worker deployment existence
- Production Supabase row counts after fresh install
- Shopify App Store submission review
