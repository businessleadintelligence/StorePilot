# Deployment Validation Checklist

**Purpose:** Gate all post-launch work (marketing site, admin portal, docs, App Store submission) until **every item below is green**.

**Rule:** Do not proceed to downstream deliverables until this checklist is 100% green with recorded evidence.

**Last validated:** 2026-07-10T08:38Z (UTC)  
**Production URL:** https://store-pilot-eta.vercel.app  
**Overall status:** 🔴 **BLOCKED — Stage 1**

---

## Summary

| Stage | Name | Status |
|-------|------|--------|
| 1 | Git | 🔴 BLOCKED |
| 2 | Vercel | 🔴 BLOCKED |
| 3 | Vercel Cron | 🟡 Verify post-deploy |
| 4 | Database | 🟡 Partial |
| 5 | Environment Variables | 🔴 BLOCKED |
| 6 | Queue | 🔴 BLOCKED |
| 7 | Shopify Sync | 🔴 BLOCKED |
| 8 | Knowledge | 🔴 BLOCKED |
| 9 | Dashboard | 🔴 BLOCKED |
| 10 | Executive COO | 🔴 BLOCKED |
| 11 | Webhooks | 🔴 BLOCKED |
| 12 | Health | 🔴 BLOCKED |
| 13 | Fresh Store E2E | 🔴 BLOCKED |
| 14 | PII Certification (new modules) | 🟡 Code review only |

---

## Stage 1 — Git

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1.1 | Push latest code | 🔴 | `origin/main` at `b1789a7` — **Phase C.2 not committed** |
| 1.2 | `git status` clean | 🔴 | **90+ modified**, **100+ untracked** files (Epic 1/2, Phase B, C.2) |
| 1.3 | Latest commit includes Epic 1 | 🔴 | Not in `b1789a7` |
| 1.4 | Latest commit includes Epic 2 | 🔴 | Not in `b1789a7` |
| 1.5 | Latest commit includes Phase B | 🔴 | Not in `b1789a7` |
| 1.6 | Latest commit includes Phase C.2 | 🔴 | Queue fix, worker, webhook, prompts — **local only** |

**Required before Stage 2:**

```bash
git add -A
git commit -m "Phase C.2: production launch remediation — queue, worker, health, webhook, onboarding truth"
git push origin main
```

**Gate:** Stage 2 cannot start until 1.1–1.6 are green.

---

## Stage 2 — Vercel

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 2.1 | Deploy latest commit | 🔴 | Production still on `b1789a7` (pre–C.2) |
| 2.2 | Deployment finished | 🔴 | — |
| 2.3 | `GET /health` → 200 | 🟢 | `200` — `{"ok":true,"mode":"liveness"}` @ 2026-07-10T08:38Z |
| 2.4 | `GET /health/ready` → 200 (not 503) | 🔴 | **503** — 3 failing checks (see below) |

### `/health/ready` failures (live, pre-deploy)

| Check | ok | reason |
|-------|-----|--------|
| shopify_scope_drift | ❌ | `env_not_in_toml` (toml missing on serverless) — **fixed in C.2 code, not deployed** |
| migrations | ❌ | `ENOENT: scandir '/var/task/prisma/migrations'` — **fixed in C.2 code, not deployed** |
| foundation_prompt_registry | ❌ | **13 prompts missing** — **fixed in C.2 code, not deployed** |

**Required:**

```bash
vercel --prod
# Then re-check /health/ready until 200
```

**Gate:** Stage 3+ blocked until 2.4 is green.

---

## Stage 3 — Vercel Cron (replaces Railway worker)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 3.1 | All 12 crons in `vercel.json` | 🟢 | RC3.5 — synced with `cron-scheduler.server.ts` |
| 3.2 | `CRON_SECRET` set on Vercel production | 🟡 | Verify via `vercel env ls production` |
| 3.3 | `/cron/worker` executes on schedule | 🟡 | Vercel Dashboard → Cron Logs after deploy |
| 3.4 | `/health/worker` healthy with cron | 🟡 | Expect `executionMode: serverless_cron`, HTTP 200 |

**Required:**

```bash
curl https://store-pilot-eta.vercel.app/health/worker
# Expect: ok true, executionMode serverless_cron, CRON_SECRET configured

# Manual cron trigger (optional)
curl -H "Authorization: Bearer $CRON_SECRET" https://store-pilot-eta.vercel.app/cron/worker
```

See [WORKER_DEPLOYMENT.md](./WORKER_DEPLOYMENT.md).

**Note:** Railway/Docker worker deployment is **not required**. `activeWorkers >= 1` is **not** a pass criterion under serverless architecture.

---

## Stage 4 — Database

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 4.1 | `npx prisma migrate deploy` run on production | 🟡 | Local: **36 migrations, schema up to date** |
| 4.2 | No pending migrations | 🟡 | Local OK; prod must be verified after deploy |

**Required (against production DATABASE_URL):**

```bash
npx prisma migrate deploy
npx prisma migrate status
# Expect: "Database schema is up to date!"
```

---

## Stage 5 — Environment Variables

Verify on **Vercel Production** and **Railway Worker**.

| Variable | Vercel Prod | Required | Notes |
|----------|-------------|----------|-------|
| `OPENAI_API_KEY` | 🟢 Present | Yes | Encrypted |
| `AI_PLATFORM_ENABLED` | 🔴 **Missing** | Yes | Required for Executive COO AI path |
| `TOKEN_ENCRYPTION_KEY` | 🟢 Present | Yes | |
| `DATABASE_URL` | 🟢 Present | Yes | |
| `DIRECT_URL` | 🟢 Present | Yes | |
| `CRON_SECRET` | 🟢 Present | Yes | |
| `SHOPIFY_APP_URL` | 🟢 Present | Yes | |
| `SHOPIFY_API_KEY` | 🟢 Present | Yes | |
| `SHOPIFY_API_SECRET` | 🟢 Present | Yes | |
| `SESSION_SECRET` | ⚪ N/A | No | Shopify sessions via Prisma `Session` table — not used |
| `SCOPES` | 🟢 Present | Yes | |
| `AI_PROVIDER` | 🟢 Present | Yes | |
| `AI_MODEL` | 🟢 Present | Yes | |

**Required:**

```bash
vercel env add AI_PLATFORM_ENABLED production
# Value: true
# Mirror all worker vars on Railway
```

---

## Stage 6 — Queue

Fresh install only (Stage 13 store). Verify job lifecycle:

| Transition | Status | Evidence |
|------------|--------|----------|
| `bootstrap_products` queued | 🔴 | Not verified post-deploy |
| → claimed | 🔴 | Requires active worker |
| → running | 🔴 | Requires `markPhaseStarted` (C.2) |
| → completed | 🔴 | — |
| No cancelled | 🔴 | C.1: job was cancelled at enqueue |
| No failed | 🔴 | — |

**SQL verification:**

```sql
SELECT "jobType", status, attempts, "createdAt", "completedAt", "cancelledAt"
FROM sync_jobs
WHERE "storeId" = '<fresh-store-id>'
ORDER BY "createdAt";
```

---

## Stage 7 — Shopify Sync

| # | Check | Status |
|---|-------|--------|
| 7.1 | Products synced (count > 0) | 🔴 |
| 7.2 | Orders synced | 🔴 |
| 7.3 | Collections visible | 🔴 |
| 7.4 | Inventory synced | 🔴 |

Verify in DB + dashboard after Stage 13 install.

---

## Stage 8 — Knowledge

| # | Check | Status |
|---|-------|--------|
| 8.1 | Evidence records created | 🔴 |
| 8.2 | Knowledge Graph built | 🔴 |
| 8.3 | Business Memory ready | 🔴 |
| 8.4 | Historical Intelligence complete | 🔴 |
| 8.5 | Quick Wins generated | 🔴 |

Verify via job completion + `/health/monitor` intelligence checks.

---

## Stage 9 — Dashboard

| # | Check | Status |
|---|-------|--------|
| 9.1 | Shows Queued → Claimed → Running → Completed | 🔴 | C.2 code not deployed |
| 9.2 | Never "Running" when job = cancelled | 🔴 | C.1 bug confirmed pre-fix |
| 9.3 | Progress 0→33→66→90→100 only after phase complete | 🔴 | C.2 code not deployed |

---

## Stage 10 — Executive COO

| # | Check | Status |
|---|-------|--------|
| 10.1 | Business Context generated | 🔴 |
| 10.2 | Executive Briefing generated | 🔴 |
| 10.3 | Daily Plan generated | 🔴 |

**Blockers:** `AI_PLATFORM_ENABLED=true` + prompt registry healthy + bootstrap complete.

---

## Stage 11 — Webhooks

| # | Check | Status |
|---|-------|--------|
| 11.1 | `app/uninstalled` fires | 🔴 |
| 11.2 | Canonical handler runs | 🔴 | C.2 fix not deployed |
| 11.3 | Store deactivated + jobs cancelled | 🔴 |
| 11.4 | Sessions deleted | 🔴 |
| 11.5 | GDPR deletion path verified | 🔴 |

Test on disposable dev store after Stage 13.

---

## Stage 12 — Health

| Endpoint | Expected | Live (2026-07-10T08:38Z) |
|----------|----------|---------------------------|
| `/health` | 200 green | 🟢 200 |
| `/health/ready` | 200 green | 🔴 503 |
| `/health/worker` | 200 green | 🔴 500 |
| `/health/monitor` | 200 green | 🔴 503 |

**Gate:** All four must return `ok: true` with no false positives.

---

## Stage 13 — Fresh Store E2E

| # | Check | Status |
|---|-------|--------|
| 13.1 | Brand-new Shopify Dev Store (never reused) | 🔴 |
| 13.2 | Install StorePilot | 🔴 |
| 13.3 | Time every stage (OAuth → 100%) | 🔴 |
| 13.4 | Reach 100% without manual intervention | 🔴 |

Record trace in [PRODUCTION_VERIFICATION.md](./PRODUCTION_VERIFICATION.md).

---

## Stage 14 — PII Certification (pre–App Store)

Verify **no customer PII** in persisted JSON, logs, or AI payloads for modules added after Phase B privacy audit.

| Module | Field-name scan | Value scan | Persist guard | Status |
|--------|-----------------|------------|---------------|--------|
| Executive Decision Engine | No email/phone fields in `app/executive/` | — | `json-pii-guard` available | 🟡 Code review |
| Root Cause Engine | `customerImpact` is numeric score, not PII | No email/phone | — | 🟡 Code review |
| Prediction Engine | No customer fields found | — | — | 🟡 Code review |
| Experiment Intelligence | No customer fields found | — | — | 🟡 Code review |
| Merchant Intelligence | No customer fields found | — | — | 🟡 Code review |
| Intelligence Workspaces | Not yet scanned in dedicated test | — | — | 🔴 Needs test |
| Adaptive Intelligence | Not yet scanned in dedicated test | — | — | 🔴 Needs test |

**Existing guards:**

- `app/lib/json-pii-guard.server.ts` — `assertJsonPayloadFreeOfCustomerPii()`
- `app/services/__tests__/privacy-hardening.test.ts` — unit tests (core guards only)
- `app/lib/privacy-by-architecture.ts` — prohibited field names

**Required before App Store submission:**

1. Add integration tests that scan persisted payloads for each new module
2. Run grep + test suite: `npm test -- privacy-hardening intelligence-pipeline`
3. Document results in `docs/remediation/PII_CERTIFICATION.md`

---

## Blocked Downstream Work

Do **not** start until this checklist is 100% green:

- Marketing Website
- Admin Portal
- Documentation / Help Center
- App Store Assets
- Shopify App Store Submission

---

## Immediate Next Actions (ordered)

1. **Commit and push** all Epic 1/2, Phase B, Phase C.2 work (Stage 1)
2. **`vercel --prod`** deploy (Stage 2)
3. **Set `AI_PLATFORM_ENABLED=true`** on Vercel + Railway (Stage 5)
4. **`railway up`** worker service (Stage 3)
5. **`npx prisma migrate deploy`** against production if needed (Stage 4)
6. Re-run health checks until Stages 2, 3, 12 are green
7. **Fresh dev store install** — Stages 6–11, 13
8. **PII certification tests** — Stage 14
9. Update this checklist with timestamps and evidence links

---

## Local Pre-Deploy Validation (already green)

| Check | Result |
|-------|--------|
| Test suite | 🟢 3033/3033 pass |
| Phase C.2 code | 🟢 Implemented locally |
| `railway.toml` + `Dockerfile.worker` | 🟢 Present (untracked) |
| Cron fallback `*/2 * * * *` | 🟢 In `vercel.json` (not deployed) |

---

## Sign-Off

| Role | Stage 1–13 | Stage 14 PII | Date |
|------|------------|--------------|------|
| Engineering | ☐ | ☐ | |
| Infrastructure | ☐ | ☐ | |
| QA / E2E | ☐ | ☐ | |
| Privacy | ☐ | ☐ | |

**Certification:** ☐ Not certified — blocked at Stage 1
