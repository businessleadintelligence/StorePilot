# StorePilot — Production Infrastructure Audit

**Date:** 2026-07-09  
**Auditor role:** Lead DevOps (read-only)  
**Scope:** `store-pilot/` + deployment docs  
**Mode:** Inspection only — no files modified, no packages installed

---

## Executive Summary

StorePilot is architected as a **Shopify embedded app** on **Vercel** (inferred) with **Supabase PostgreSQL** via **Prisma**, background work via an **HTTP cron worker** (`POST /cron/worker`), and **no Railway** footprint. Application code includes strong **startup readiness checks**, **encrypted session storage**, **webhook idempotency**, and an internal **production health engine** — but **production wiring is incomplete**.

| Area | Readiness |
|------|-----------|
| Code quality gates | **Green** — 2,822 tests, typecheck 0, build passes |
| Vercel deployment config | **Yellow** — project exists; no `vercel.json`, cron not configured |
| Supabase / Prisma | **Yellow** — new DB connected locally; prod migrate/env on Vercel unverified |
| Shopify | **Yellow** — `shopify.app.toml` restored; dev store link failed previously |
| Background workers | **Red** — worker route exists; `CRON_SECRET` missing; no scheduler deployed |
| AI runtime | **Red** — `AI_PROVIDER`, `AI_MODEL`, `OPENAI_API_KEY` not in local `.env` |
| Email (Resend) | **Red** — not implemented (PRD P1 requirement) |
| Observability | **Red** — console logs only; no Sentry/Datadog/OpenTelemetry |
| Railway | **N/A** — not used |
| Production E2E validation | **Red** — 0/14 phases per prior validation docs |

**Overall production readiness: ~35–40%** (infrastructure wiring, not application code depth)

---

## 1. Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MERCHANT / SHOPIFY ADMIN                         │
│                    (Embedded App Bridge + OAuth 2.0)                     │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  VERCEL (inferred) — store-pilot-eta.vercel.app                          │
│  React Router 7 SSR + @react-router/serve                                │
│  Build: prisma generate → react-router build                             │
│  Start: react-router-serve ./build/server/index.js                       │
└───────┬─────────────────────────────┬───────────────────┬───────────────┘
        │                             │                   │
        │ Prisma (pooler :6543)       │ Webhooks          │ External sched.
        ▼                             ▼                   ▼
┌───────────────────┐    ┌────────────────────┐   ┌─────────────────────┐
│ SUPABASE Postgres │    │ Shopify Webhooks   │   │ POST /cron/worker   │
│ (Tokyo ap-ne-1)   │    │ HMAC validated     │   │ x-cron-secret auth  │
│ DIRECT_URL :5432  │    │ Idempotent lease   │   │ runWorkerCycle()    │
└───────────────────┘    └────────────────────┘   └─────────────────────┘
        │
        │ Optional connectors
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Google OAuth → GA4, GSC, PageSpeed  |  Microsoft Clarity API token      │
│ OpenAI API (AI Platform v2)         |  Shopify Billing API              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Runtime stack (actual vs Technical PRD)

| Layer | PRD assumed | Actual |
|-------|-------------|--------|
| Frontend | Next.js App Router | **React Router 7** + Shopify Polaris web components |
| API | Next.js API routes | **React Router loaders/actions** + `.server.ts` services |
| Hosting | Vercel | **Vercel** (`application_url` in TOML) |
| Database | Supabase PostgreSQL | **Supabase PostgreSQL** (new project `rbzhmuqduircqloqoepa`) |
| ORM | Prisma | **Prisma 6.19** — 22 migrations |
| Email | Resend | **Not implemented** |
| Workers | Vercel Cron | **HTTP cron route** — scheduler **not deployed** |
| Containers | — | **Dockerfile** exists (`docker-start` = migrate + serve) — alternate path |

### Key production routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/auth/*` | Shopify OAuth | Public |
| `/app/*` | Merchant embedded UI | Shopify session |
| `/webhooks/*` | Shopify + GDPR webhooks | HMAC (`validateWebhookRequest`) |
| `/cron/worker` | Background job processor | `x-cron-secret` header |
| `/auth/google/callback` | Google connector OAuth | OAuth state |
| `/internal/founder` | Founder ops dashboard | **404 in production** |

### Background job model

- Jobs stored in `sync_jobs` (Prisma)
- Enqueued on install, onboarding, orders scheduler, product bootstrap
- Processed by `runWorkerCycle()` via `/cron/worker` (one job per POST)
- **No in-process worker daemon** — requires external scheduler every 1–2 minutes
- Orders incremental sync scheduled from worker completion (`orders-scheduler.server.ts`)

### Monitoring (in-app only)

`production-engine.ts` monitors 13+ subsystems per store: Shopify, connectors, OAuth/billing, database, webhooks, background jobs, worker queue, security, performance, AI platform, automation, operations, data quality. Exposed at `/app/system-health`. **Not exported to external APM.**

### Logging

- `console.info/warn/error` with prefixed structured payloads
- `createSafeLogger()` redacts sensitive keys (`safe-log.server.ts`)
- **No centralized log aggregation** configured in repo

---

## 2. Missing Services

| Service | PRD / code expectation | Status |
|---------|------------------------|--------|
| **Vercel Cron / external scheduler** | `F42_WORKER_CRON_DEPLOYMENT.md` | **Missing** — no `vercel.json`, no documented live scheduler |
| **Resend** (email briefings/reports) | PRD FR-28–FR-33 | **Not implemented** — no dependency, no env vars |
| **Railway** | User audit scope | **Not present** — no config, no references |
| **Sentry / Datadog / OpenTelemetry** | Production best practice | **Not present** |
| **Supabase Edge Functions** | Optional | Not used |
| **Redis / queue broker** | Not required by design | Not present (DB-backed job queue) |
| **CDN beyond Vercel** | — | Vercel default only |
| **Secrets manager** | Vercel env vars expected | **Not verified** on Vercel project |
| **Backup service (explicit)** | — | Relies on **Supabase platform backups** (not documented in repo) |
| **Status page / uptime monitor** | — | **Missing** |
| **WAF / DDoS** | — | Vercel platform default only |

---

## 3. Missing Environment Variables

### Required for production boot (code-enforced)

From `startup-readiness.server.ts` and `production-security.ts`:

| Variable | Local `.env` | Required | Purpose |
|----------|--------------|----------|---------|
| `DATABASE_URL` | ✓ Present | **Yes** | Prisma pooled connection (Supabase pooler :6543) |
| `DIRECT_URL` | ✓ Present | **Yes** | Prisma direct connection (migrations) |
| `SHOPIFY_API_KEY` | ✓ Present | **Yes** | App Bridge + OAuth |
| `SHOPIFY_API_SECRET` | ✓ Present | **Yes** | Webhook HMAC + OAuth |
| `SHOPIFY_APP_URL` | ✓ Present | **Yes** | OAuth redirects, webhook registration |
| `SCOPES` | ⚠ Present | **Yes** | Must match `shopify.app.toml` |
| `TOKEN_ENCRYPTION_KEY` | ✗ Missing | **Yes** | Session + connector token encryption |
| `CRON_SECRET` | ✗ Missing | **Yes** | Worker queue enabled check fails without it |

### Required for AI Platform runtime

From `ai-config.ts` / `ai/providers/index.ts`:

| Variable | Local `.env` | Required | Purpose |
|----------|--------------|----------|---------|
| `AI_PROVIDER` | ✗ Missing | **Yes** (when AI runs) | e.g. `openai` |
| `AI_MODEL` | ✗ Missing | **Yes** (when AI runs) | Model slug |
| `OPENAI_API_KEY` | ✗ Missing | **Yes** (OpenAI provider) | API authentication |
| `AI_TEMPERATURE` | — | Optional | Default 0.2 |
| `AI_MAX_TOKENS` | — | Optional | Default 2048 |
| `AI_TIMEOUT_MS` | — | Optional | Default 30000 |
| `AI_STRUCTURED_OUTPUT_ENABLED` | — | Optional | Default true |

### Required for Google connectors (optional feature)

| Variable | Local `.env` | Purpose |
|----------|--------------|---------|
| `GOOGLE_CLIENT_ID` | ✗ Missing | GA4/GSC/PageSpeed OAuth |
| `GOOGLE_CLIENT_SECRET` | ✗ Missing | OAuth token exchange |

### Supabase client (added for new project)

| Variable | Local `.env` | Used in app code? |
|----------|--------------|-------------------|
| `SUPABASE_URL` | ✓ Present | **Not referenced** in `app/` TypeScript — Prisma-only DB access |
| `SUPABASE_ANON_KEY` | ✓ Present | **Not referenced** in app code |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ Present | **Not referenced** in app code |

### Prisma schema references (dev/migrate only)

| Variable | Local `.env` | Notes |
|----------|--------------|-------|
| `SHADOW_DATABASE_URL` | ✗ Missing | Only needed for `prisma migrate dev` — not production runtime |

### Optional / operational

| Variable | Purpose |
|----------|---------|
| `CRON_JOB_BATCH_SIZE` | Worker batch size (default 3) |
| `BILLING_TEST_MODE` | `1` forces test charges; must be unset in prod |
| `SHOP_CUSTOM_DOMAIN` | Custom shop domain support |
| `PORT` / `FRONTEND_PORT` | Local dev / Docker |
| `NODE_ENV` | `production` on Vercel |

### PRD-required but not in codebase

| Variable | PRD | Status |
|----------|-----|--------|
| `RESEND_API_KEY` | Daily/weekly COO emails | **No code references** |

### No `.env.example` in repository

There is **no committed env template** — onboarding new environments relies on tribal knowledge and `startup-readiness` checks.

---

## 4. Missing Production Configuration

| Configuration | Expected | Actual |
|---------------|----------|--------|
| **`vercel.json`** | Cron schedule for `/cron/worker` | **Missing** — documented in `F42_WORKER_CRON_DEPLOYMENT.md` only |
| **Vercel root directory** | `store-pilot/` | **Pending** per `SETUP_STATUS.md` — may deploy wrong folder |
| **Vercel env vars** | Full secret set | **Not verified** — local `.env` incomplete |
| **`prisma migrate deploy` on deploy** | Required for schema | **Not in `build` script** — only in `docker-start` / `setup` |
| **Shopify `shopify app deploy`** | Register webhooks to prod URL | **Manual** — not automated in CI |
| **Supabase connection pooling** | `DATABASE_URL` → pooler | ✓ Configured in local `.env` pattern |
| **Supabase RLS** | Row-level security | **Not configured in repo** — app uses service-level Prisma |
| **GitHub Actions CI** | Test + deploy | **Not found** in repo |
| **Health check endpoint for platform** | `/cron/worker` GET health? | Loader returns health JSON; **not wired to Vercel health checks** |
| **Rate limiting (HTTP)** | Edge protection | **Not implemented** at app edge |
| **CSP / security headers** | Hardening | **Shopify `addDocumentResponseHeaders` only** — no custom CSP in `entry.server.tsx` |
| **Error boundary / 500 page** | UX | React Router defaults + `console.error` |

---

## 5. Broken Production Assumptions

| Assumption | Reality |
|------------|---------|
| **Worker queue processes jobs automatically** | `getStartupReadiness()` marks `worker_queue` disabled when `CRON_SECRET` missing; even with secret, **no scheduler invokes** `/cron/worker` |
| **`SCOPES` env matches `shopify.app.toml`** | Local `.env` still references **template scopes** (`write_metaobjects`); **missing `read_orders`** — conflicts with restored TOML and `MINIMUM_SHOPIFY_SCOPES` |
| **Vercel build applies migrations** | `npm run build` = `prisma generate && react-router build` only — **schema must be migrated separately** |
| **Supabase env vars power the app** | `SUPABASE_*` keys are set but **unused** — only `DATABASE_URL`/`DIRECT_URL` matter for current code |
| **Billing charges real merchants in production** | `shopify-billing.server.ts`: test mode when `BILLING_TEST_MODE=1` **OR** `NODE_ENV !== 'production'` |
| **Operations/Automation state persists** | Routes use **in-memory persistence** — resets on serverless cold start |
| **Collaboration engine runs in production** | `executeCollaboration` **not wired** to cron/jobs — dashboards read cached output only |
| **PRD email briefings work** | **Resend not integrated** |
| **Real-store validation docs reflect current code** | `LAUNCH_BLOCKERS.md` (2026-06-29) predates recovery — LB-004 (missing routes) **outdated** |
| **Dockerfile is production path** | Exists but **Vercel is primary**; Docker `npm ci --omit=dev` may break if devDeps needed for build |
| **Founder dashboard available in prod** | `/internal/founder` returns **404** when `NODE_ENV=production` |
| **Google rate limits survive serverless** | In-memory `Map` in `google-rate-limit.ts` — **resets per instance** |

---

## 6. Missing Secrets (production)

Secrets that **must** be set on Vercel (and are **missing locally**):

| Secret | Impact if missing |
|--------|-------------------|
| `TOKEN_ENCRYPTION_KEY` | Cannot encrypt Shopify sessions; startup readiness **fails** |
| `CRON_SECRET` | Worker queue disabled; onboarding/sync jobs **stall** |
| `OPENAI_API_KEY` | All AI agent runs **fail** |
| `AI_PROVIDER` + `AI_MODEL` | AI config load **throws** |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Connector OAuth **disabled** (graceful) |
| Clarity API token | Per-store in DB after merchant connects — not a global secret |

Secrets **present locally** (names only — do not commit):

- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_*`

**Rotation / versioning:** No documented secret rotation procedure in repo.

---

## 7. Deployment Blockers

| # | Blocker | Severity |
|---|---------|----------|
| 1 | **Vercel production env vars incomplete** — `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, AI vars | Critical |
| 2 | **`SCOPES` mismatch** — local/prod env may not include `read_orders` | Critical |
| 3 | **No cron scheduler** — jobs enqueue but never process | Critical |
| 4 | **`prisma migrate deploy` not run** on production Supabase | Critical |
| 5 | **Vercel root directory** may point to repo root instead of `store-pilot/` | Critical |
| 6 | **Dev store not linked** — `shopify app dev` failed (Partner org) | High |
| 7 | **`shopify app deploy`** not confirmed — webhooks may not match prod URL | High |
| 8 | **Zero real-store E2E** — OAuth, webhooks, billing unproven | High |
| 9 | **No `.env.example`** — deployment error-prone | Medium |
| 10 | **Billing test mode** defaults safe but must verify `NODE_ENV=production` on Vercel | Medium |

---

## 8. Security Risks

| Risk | Severity | Detail |
|------|----------|--------|
| **Missing `TOKEN_ENCRYPTION_KEY`** | Critical | Sessions stored encrypted in app layer; without key, crypto fails at runtime |
| **`CRON_SECRET` missing** | High | Worker endpoint returns 401 — good — but queue disabled leaves stale data |
| **`/cron/worker` is public URL** | Medium | Protected by shared secret only — brute-force surface if secret weak |
| **No WAF / IP allowlist on cron** | Medium | Anyone can POST; only secret protects |
| **Console-only logging** | Medium | No tamper-proof audit trail; secrets could leak if sanitization bypassed |
| **In-memory rate limits** | Low | Google API rate limit state not shared across Vercel instances |
| **Founder route** | Low | Correctly 404 in production |
| **Dev route guard** | Low | `/app/dev/sync-products` blocked when `NODE_ENV=production` |
| **GDPR webhooks** | Low (fixed in TOML) | Restored in `shopify.app.toml`; must redeploy to Shopify |
| **Supabase keys in `.env`** | Medium | Service role key in local file — must never ship to client; currently unused by app |
| **No RLS on Supabase** | Medium | Single DB user via Prisma — acceptable if credentials protected |
| **Webhook idempotency** | Low (strength) | Lease-based processing in `webhook.server.ts` — good pattern |
| **Privacy scopes** | Low (strength) | Minimum scopes enforced in code + TOML |

---

## 9. Performance Risks

| Risk | Impact |
|------|--------|
| **Serverless cold starts** | Slow first dashboard load after idle |
| **One job per cron POST** | Backlog after mass install — needs 1–2 min cron or batch increase |
| **Production health cache 30s in-memory** | Stale health on multi-instance; per-instance cache |
| **AI agent runs** | Long-running LLM calls may hit Vercel function timeout (plan-dependent) |
| **Prisma connection pooler** | Correct pattern for serverless; pool exhaustion if concurrency spikes |
| **No CDN cache headers audit** | Static assets via Vite build — Vercel default caching |
| **Large SSR bundle** | `build/server/index.js` ~1.8MB — monitor cold start |
| **No query performance monitoring** | Prisma queries uninstrumented externally |
| **Connector sync bursts** | GA4/GSC/PageSpeed/Clarity sequential sync may timeout |

---

## 10. Recommended Implementation Order

| Phase | Action | Est. effort |
|-------|--------|-------------|
| **1** | Fix Vercel project: root = `store-pilot/`, Node 20.x | 30 min |
| **2** | Set all production env vars on Vercel (see §3, §6) | 1 hr |
| **3** | Align `SCOPES` env with `shopify.app.toml` (`read_products,read_inventory,write_products,read_orders`) | 15 min |
| **4** | Run `npx prisma migrate deploy` against production Supabase | 30 min |
| **5** | Deploy app; run `shopify app deploy` to register webhooks | 1 hr |
| **6** | Configure external cron (GitHub Actions / cron-job.org) → `POST /cron/worker` every 2 min with `x-cron-secret` | 1 hr |
| **7** | Link dev store in Partner Dashboard; `shopify app dev` smoke test all routes | 2–4 hr |
| **8** | Real-store E2E checklist (`REAL_STORE_VALIDATION.md`) | 1–2 days |
| **9** | Add `vercel.json` or document external cron; add `.env.example` | 1 hr |
| **10** | External observability (Sentry minimum) + log drain | 4 hr |
| **11** | Persist Operations/Automation to DB (not in-memory) | 1–2 days |
| **12** | Wire `executeCollaboration` to worker schedule | 4 hr |
| **13** | Resend integration for PRD email briefings | 2–3 days |
| **14** | Supabase backup policy documentation + PITR verification | 2 hr |

---

## Appendix A — Shopify Configuration

| Item | Value |
|------|-------|
| `application_url` | `https://store-pilot-eta.vercel.app` |
| `embedded` | `true` |
| `api_version` | `2025-10` |
| Scopes | `read_products,read_inventory,write_products,read_orders` |
| Redirect URLs | `/auth/callback`, `/api/auth/callback` |
| Webhooks | 14 subscriptions (app, catalog, inventory, orders, billing, GDPR) |
| OAuth | Shopify App Bridge + `@shopify/shopify-app-react-router` |

---

## Appendix B — Prisma / Supabase

| Item | Detail |
|------|--------|
| Provider | PostgreSQL via Supabase |
| Migrations | 22 (repaired for fresh DB) |
| Models | Store, User, Product, Order, Subscription, AI platform v2, connectors, jobs, webhooks |
| `directUrl` | Required for migrations |
| `shadowDatabaseUrl` | In schema; optional at runtime |
| Local DB | New Tokyo project — migrated via `migrate reset` in dev |
| Backup | **Not documented in repo** — enable Supabase PITR in dashboard |

---

## Appendix C — Build Pipeline

```
npm run build
  → prisma generate
  → react-router build (client + SSR)

npm run postinstall
  → prisma generate

Docker alternative:
  → npm ci --omit=dev
  → npm run build
  → npm run docker-start (migrate deploy + serve)
```

**CI:** No GitHub Actions workflow found. Quality gates verified manually: test, typecheck, build.

---

## Appendix D — Railway

**Not applicable.** No Railway configuration, environment references, or deployment docs exist in the repository. StorePilot is designed for **Vercel + Supabase**, with optional **Docker** for self-hosted deployment.

---

## Conclusion

StorePilot has **mature application-level production patterns** (readiness checks, encrypted sessions, webhook leases, health engine) but **immature infrastructure wiring**. The largest gaps are **missing production secrets on the host**, **no background worker scheduler**, **unverified Vercel/Supabase deploy**, and **no real-store validation**. Code is deployable; **infrastructure is not yet production-ready**.

**Do not treat `store-pilot-eta.vercel.app` as production-ready until Phases 1–8 above are complete.**
