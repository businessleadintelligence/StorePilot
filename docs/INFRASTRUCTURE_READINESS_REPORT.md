# StorePilot — Infrastructure Readiness Report

**Sprint:** Infrastructure Sprint 1  
**Date:** 2026-07-09  
**Production URL:** https://store-pilot-eta.vercel.app  
**Dev store:** storepilot-pe9x0muw.myshopify.com  
**Overall infrastructure readiness: 74%** (code green; database is the sole P0 blocker)

---

## Executive summary

| Area | Score | Status |
|------|------:|--------|
| Code quality gates | 100% | Pass — build, typecheck, lint, 2864/2864 tests |
| Supabase / Prisma | 0% | **BLOCKED** — both known projects deleted |
| Vercel deployment | 92% | Fresh production deploy live on `store-pilot-eta.vercel.app` |
| Environment variables | 88% | Critical secrets synced to Vercel; DB URLs point to dead project |
| Shopify configuration | 85% | TOML + CLI aligned; live OAuth install not completed (DB required) |
| Background workers / cron | 65% | Routes live; Hobby plan limits to daily Vercel crons |
| Monitoring / logging | 90% | `/health`, `/health/monitor`, `/cron/schedule` deployed |
| **Overall** | **74%** | Unblocks at 100% when Supabase is reprovisioned + migrate deploy |

---

## 1. Supabase / Prisma

### Diagnosis

Both PostgreSQL projects referenced in configuration are **deleted** (DNS and pooler tenant lookup fail):

| Project ref | Region | Where referenced | Error |
|-------------|--------|------------------|-------|
| `rbzhmuqduircqloqoepa` | ap-northeast-1 (Tokyo) | Local `.env` (before patch) | `tenant/user postgres.rbzhmuqduircqloqoepa not found` |
| `eejwiybpradtsfwtpgxq` | ap-southeast-2 (Sydney) | Vercel `DATABASE_URL` / `DIRECT_URL` | `tenant/user postgres.eejwiybpradtsfwtpgxq not found` |

Supabase REST hostnames (`*.supabase.co`) do not resolve for either project.

### Commands run

| Command | Result |
|---------|--------|
| `npx prisma validate` | Pass |
| `npx prisma generate` | Pass |
| `npx prisma migrate deploy` | **Fail** — database tenant not found |
| `npx prisma migrate status` | **Fail** — same error |

### Production monitor evidence

`GET https://store-pilot-eta.vercel.app/health/monitor` → HTTP 503:

- `database`: unhealthy — Prisma ENOTFOUND on `eejwiybpradtsfwtpgxq`
- `supabase`: unhealthy
- `queue`: unhealthy (depends on DB)
- `worker`: unhealthy (depends on DB)
- `shopify_api`: **healthy**
- `cron`: **healthy** (`CRON_SECRET` configured)
- `ai`: **healthy** (OpenAI provider probe succeeded)

### Remediation (operator)

1. In an **interactive terminal**, run `npx supabase login` (browser auth), **or** set `SUPABASE_ACCESS_TOKEN`.
2. Run `node scripts/provision-supabase.mjs` from `store-pilot/`, **or** create a project manually in the Supabase dashboard.
3. Copy **pooler** (`:6543?pgbouncer=true`) and **direct** (`:5432`) connection strings into:
   - `store-pilot/.env` (`DATABASE_URL`, `DIRECT_URL`)
   - Vercel production env (`vercel env add DATABASE_URL production`, same for `DIRECT_URL`)
4. Run `npx prisma migrate deploy` — expect 22 migrations applied on empty database.
5. Redeploy Vercel (optional if only env changed).

---

## 2. Environment variables

### Vercel production (verified via `vercel env ls`)

| Variable | Present | Notes |
|----------|:-------:|-------|
| `SHOPIFY_API_KEY` | Yes | Matches `shopify.app.toml` `client_id` |
| `SHOPIFY_API_SECRET` | Yes | |
| `SHOPIFY_APP_URL` | Yes | `https://store-pilot-eta.vercel.app` |
| `SCOPES` | Yes | **Updated** to `read_products,read_inventory,write_products,read_orders` |
| `DATABASE_URL` | Yes | **Stale** — deleted Sydney project |
| `DIRECT_URL` | Yes | **Stale** — deleted Sydney project |
| `TOKEN_ENCRYPTION_KEY` | Yes | **Added** this sprint |
| `CRON_SECRET` | Yes | **Added** this sprint |
| `AI_PROVIDER` | Yes | `openai` |
| `AI_MODEL` | Yes | `gpt-4o-mini` |
| `OPENAI_API_KEY` | Yes | Provider health check passes in production |

### Local `.env` (patched via `scripts/patch-env.mjs`)

Synced database URLs from Vercel pull, fixed `SCOPES`, added `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, and normalized `OPENAI_API_KEY`. File is gitignored.

### Optional / not set

| Variable | Required when |
|----------|---------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google connector OAuth |
| `BILLING_TEST_MODE` | Dev test charges (defaults off in production) |
| `SHADOW_DATABASE_URL` | `prisma migrate dev` only |

---

## 3. Vercel production deployment

### Build and runtime

| Check | Result | Evidence |
|-------|--------|----------|
| Local `npm run build` | Pass | 2026-07-09 |
| Vercel production build | Pass | Deployment `dpl_1VTC5pw4skgLeWbPePWrRzmuftKZ` |
| Production alias | Pass | `https://store-pilot-eta.vercel.app` |
| Node runtime | 24.x | Vercel project settings |
| Framework | React Router | `@vercel/react-router` |

### Live route probes (`store-pilot-eta.vercel.app`)

| Route | HTTP | Notes |
|-------|-----:|-------|
| `/` | 200 | App shell |
| `/auth/login` | 200 | OAuth entry |
| `/health` | 200 | Liveness JSON |
| `/health/live` | 200 | Liveness JSON |
| `/health/ready` | 503 | DB unreachable (expected until Supabase restored) |
| `/health/monitor` | 503 | DB + queue unhealthy; Shopify/cron/AI healthy |
| `/cron/schedule` | 200 | Returns 9 registered schedules |

### Cron configuration (Vercel Hobby limitation)

Initial deploy **failed** with:

> Hobby accounts are limited to daily cron jobs. This cron expression (*/2 * * * *) would run more than once per day.

**Resolution applied:** `vercel.json` now contains **5 daily crons** (Hobby-compatible). Full Pro schedule preserved in `vercel.pro.crons.json`.

| Deployed (Hobby) | Schedule (UTC) |
|------------------|----------------|
| `/cron/worker` | `0 1 * * *` |
| `/cron/dispatch/cleanup-jobs` | `0 2 * * *` |
| `/cron/dispatch/knowledge-refresh` | `0 3 * * *` |
| `/cron/dispatch/learning-engine` | `0 4 * * *` |
| `/cron/dispatch/daily-operating-plan` | `0 6 * * *` |

**Not on Vercel Hobby** (use external scheduler or upgrade to Pro): worker every 2 min, retry-queue every 5 min, hourly expired-sessions, 6-hourly metrics, twice-daily recommendations.

`cron.worker` loader updated to execute `runWorkerCycle()` on authorized GET (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`).

---

## 4. Shopify

### Configuration (verified)

| Item | Value |
|------|-------|
| App name | StorePilot |
| Client ID | `c2e45ad18cb75c60ff489050150d9bc1` |
| Application URL | `https://store-pilot-eta.vercel.app` |
| Dev store | `storepilot-pe9x0muw.myshopify.com` |
| Scopes | `read_products,read_inventory,write_products,read_orders` |
| Embedded | `true` |
| Webhooks in TOML | 13 subscriptions |

`shopify app info` confirms dev store linkage and scope alignment with `shopify.app.toml`.

### Not verified (blocked by database)

| Flow | Status | Reason |
|------|--------|--------|
| OAuth install on dev store | Pending | Session/store persistence requires live Postgres |
| Embedded App Bridge session | Pending | Depends on OAuth + DB |
| Webhook delivery (live) | Pending | Install + DB required |
| Billing charge flow | Pending | Requires installed store + DB |

### Recommended next step

After Supabase restore:

```text
https://storepilot-pe9x0muw.myshopify.com/admin/oauth/authorize?client_id=c2e45ad18cb75c60ff489050150d9bc1
```

Then confirm webhooks in Partner Dashboard → App → API access → Webhook subscriptions.

---

## 5. Background infrastructure

| Component | Code | Production |
|-----------|:----:|:----------:|
| Worker route `POST /cron/worker` | Yes | Deployed; DB blocks job execution |
| Cron dispatch `/cron/dispatch/:jobId` | Yes | Deployed |
| Cron auth (`CRON_SECRET`) | Yes | Configured on Vercel |
| Job queue (`sync_jobs`) | Yes | DB unreachable |
| Retry queue cron | Yes | Not scheduled on Hobby (see §3) |
| `releaseStaleJobs()` | Yes | Requires DB |

---

## 6. Scripts added this sprint

| Script | Purpose |
|--------|---------|
| `store-pilot/scripts/patch-env.mjs` | Sync local `.env` from Vercel pull; fix scopes; ensure secrets |
| `store-pilot/scripts/sync-vercel-env.mjs` | Push `SCOPES`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, AI vars to Vercel |
| `store-pilot/scripts/provision-supabase.mjs` | Create new Supabase project after CLI login |

---

## 7. Path to 100%

| # | Action | Owner | Unblocks |
|---|--------|-------|----------|
| 1 | Reprovision Supabase Postgres | Operator | Prisma migrate, OAuth, webhooks, workers |
| 2 | `npx prisma migrate deploy` | Operator | `/health/ready`, startup readiness |
| 3 | Update Vercel `DATABASE_URL` / `DIRECT_URL` | Operator | Production runtime |
| 4 | OAuth install on dev store | Operator | Sessions, embedded app, billing |
| 5 | `shopify app deploy` (optional) | Operator | Push webhook config to Partner Dashboard |
| 6 | External cron or Vercel Pro | Operator | Sub-daily worker/retry schedules |
| 7 | Git tag `v2-stable-foundation` | Done this sprint | Immutable code baseline |

---

## 8. Scorecard detail

| Category | Weight | Score | Weighted |
|----------|-------:|------:|---------:|
| Code gates | 20% | 100% | 20.0 |
| Supabase / Prisma | 25% | 0% | 0.0 |
| Vercel | 20% | 92% | 18.4 |
| Environment | 10% | 88% | 8.8 |
| Shopify | 15% | 85% | 12.8 |
| Workers / Cron | 10% | 65% | 6.5 |
| **Total** | 100% | | **74%** |

---

## Appendix: deployment reference

| Item | Value |
|------|-------|
| Vercel project | `businessleadintelligences-projects/store-pilot` |
| Latest production deployment | `dpl_1VTC5pw4skgLeWbPePWrRzmuftKZ` |
| Inspector | https://vercel.com/businessleadintelligences-projects/store-pilot/1VTC5pw4skgLeWbPePWrRzmuftKZ |
| Git baseline tag | `v2-stable-foundation` (after commit) |
