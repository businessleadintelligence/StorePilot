# StorePilot — Production Checklist

**Last updated:** 2026-07-09 (Sprint 10 verification)  
**Purpose:** Single deployment checklist for all external dependencies. Update the **Verified** column only after a command, test, or live probe confirms status.

**Legend:** ☑ configured / passing · ☐ not configured or failing · **N/A** not used by StorePilot · **—** not verified this sprint

---

## External services

| Service | Status | Verified | Evidence / notes |
|---------|:------:|:--------:|------------------|
| Shopify Partner App | ☑ | — | `shopify.app.toml` present; `client_id` matches local `SHOPIFY_API_KEY`. Partner Dashboard not accessed this sprint. |
| Shopify Dev Store | ☐ | — | No live OAuth install flow executed this sprint. |
| Supabase | ☐ | ☑ | `npx prisma migrate status` → `FATAL: tenant/user postgres.rbzhmuqduircqloqoepa not found` (2026-07-09). |
| Vercel | ☑ | ☑ | `https://store-pilot-eta.vercel.app/` → HTTP 200 (2026-07-09). Deploy is **stale** — sprint routes not live (see below). |
| Railway | N/A | ☑ | No Railway config or references in repository. |
| GitHub | ☑ | ☑ | Remote: `https://github.com/businessleadintelligence/StorePilot.git`. HEAD: `7eea1ca`. |
| Resend | N/A | ☑ | Not implemented — no dependency or env vars in codebase. |
| Domain | ☑ | ☑ | `store-pilot-eta.vercel.app` resolves and serves content. |
| DNS | ☑ | ☑ | Vercel-managed; domain resolves. |
| SSL | ☑ | ☑ | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` on production root. |

---

## Application infrastructure

| Item | Status | Verified | Evidence / notes |
|------|:------:|:--------:|------------------|
| Environment Variables | ☐ | ☑ | Local `.env` missing `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`. `SCOPES` misconfigured vs `shopify.app.toml`. Vercel env not audited (no dashboard access). |
| Webhooks | ☑ | ☑ | 13 routes in `shopify.app.toml`; **69/69** webhook/GDPR tests pass. Live delivery not verified. |
| OAuth | ☑ | — | Shopify SDK + Google OAuth tests pass. Live install not verified. |
| Cron Jobs | ☑ | ☑ | 9 schedules in `vercel.json`; **29/29** cron/worker tests pass. Production `/cron/schedule` → HTTP 404 (stale deploy). |
| Monitoring | ☐ | ☑ | Unit tests pass (21/21 logging + monitoring). Production `/health/*` → HTTP 404 (stale deploy). |
| Logging | ☑ | ☑ | `app/lib/logging/` + **21/21** logging/monitoring unit tests pass. |
| Backups | ☐ | — | `docs/BACKUP_AND_RECOVERY.md` exists. Supabase backup status not verified (DB unreachable). |
| Disaster Recovery | ☑ | — | Runbooks documented in `docs/BACKUP_AND_RECOVERY.md`. Not drill-tested. |

---

## Code quality gates

| Gate | Status | Verified | Evidence / notes |
|------|:------:|:--------:|------------------|
| Build (`npm run build`) | ☑ | ☑ | Exit 0 — 2026-07-09 |
| Typecheck (`npm run typecheck`) | ☑ | ☑ | Exit 0 — 2026-07-09 (after `health.test.ts` fix) |
| Tests (`npm test`) | ☐ | ☑ | **2860/2864** pass — 4 failures in trend-intelligence (2026-07-09) |
| Prisma schema (`prisma validate`) | ☑ | ☑ | Valid — 2026-07-09 |
| Prisma migrations applied | ☐ | ☑ | **BLOCKED** — database unreachable (2026-07-09) |

---

## Production deployment status

| Check | Result | Verified |
|-------|--------|:--------:|
| Root `/` serves app | HTTP 200 | ☑ |
| `/app` embedded route | HTTP 410 Gone | ☑ |
| `/health` | HTTP 404 | ☑ |
| `/health/ready` | HTTP 404 | ☑ |
| `/health/monitor` | HTTP 404 | ☑ |
| `/cron/schedule` | HTTP 404 | ☑ |
| Sprint 2–9 code committed | No — extensive uncommitted changes | ☑ |
| Sprint 2–9 code deployed | No — production serves older build | ☑ |

---

## Pre-launch actions (ordered)

1. **Restore Supabase** — fix or recreate project; verify `DATABASE_URL` / `DIRECT_URL`.
2. **Run migrations** — `npx prisma migrate deploy` against live database.
3. **Set production secrets on Vercel** — `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SCOPES`, AI vars.
4. **Commit and push** sprint infrastructure changes (health, cron, monitoring, logging, GDPR fix).
5. **Redeploy Vercel** — confirm `/health`, `/cron/schedule` return 200.
6. **Fix trend-intelligence tests** — 4 failing tests block 100% test gate.
7. **Verify Shopify** — install on dev store; confirm webhooks deliver.
8. **Verify cron** — confirm Vercel cron fires with `CRON_SECRET`.

---

## Sprint completion tracker

| Sprint | Doc | Checklist impact |
|--------|-----|------------------|
| 2 — Vercel | `VERCEL_SETUP_REPORT.md` | Vercel, Domain, DNS, SSL |
| 4 — Env secrets | `ENVIRONMENT_VARIABLES.md` | Environment Variables |
| 5 — Logging | `LOGGING_ARCHITECTURE.md` | Logging |
| 6 — Monitoring | `MONITORING_SETUP.md` | Monitoring |
| 7 — Backups | `BACKUP_AND_RECOVERY.md` | Backups, Disaster Recovery |
| 8 — Cron | `CRON_SCHEDULE.md` | Cron Jobs |
| 9 — Security | `SECURITY_AUDIT.md` | Webhooks, OAuth, GDPR |
| 10 — Verification | `PRODUCTION_READINESS_REPORT.md` | All gates scored |

---

## How to update this checklist

After each sprint or deploy:

1. Run verification commands from `PRODUCTION_READINESS_REPORT.md`.
2. Update **Status** (☑/☐) based on current state.
3. Mark **Verified** (☑) only when you have command output, test results, or live probe evidence.
4. Add date and evidence to the notes column.
