# Worker Verification — Phase C.1

**Date:** 2026-07-10  
**Verification methods:** Runtime endpoint, database query, codebase trace

---

## Questions Answered

| Question | Answer | Evidence |
|----------|--------|----------|
| Is Railway worker deployed? | **Not verified — no evidence of deployment** | 0 rows in `worker_instances`; no Railway config in repo |
| Is Docker worker deployed? | **Not verified** | `Dockerfile.worker` exists; no runtime registration |
| Is worker heartbeat updating? | **No** | `workers: []` in `/health/worker` |
| Are worker instances registered? | **No** | DB: `worker_instances` count = 0 |
| Is worker polling? | **No** | activeWorkers: 0; throughputLastHour: 0 |
| How many active workers? | **0** | `/health/worker` 2026-07-10T07:40:31Z |

---

## `/health/worker` (Verified in production)

```json
{
  "ok": false,
  "status": "unhealthy",
  "queue": {
    "queued": 0, "claimed": 0, "running": 0,
    "deadLetter": 0, "cancelled": 1
  },
  "workers": {
    "activeWorkers": 0,
    "drainingWorkers": 0,
    "staleWorkers": 0,
    "workers": []
  },
  "alerts": ["no_active_workers"],
  "throughputLastHour": 0
}
```

---

## Database: `worker_instances` (Verified via database)

| Field | Value |
|-------|-------|
| Total rows | **0** |
| Latest heartbeat | **None** |

---

## bootstrap_products Lifecycle (Verified via database)

| Stage | Expected | Actual |
|-------|----------|--------|
| queued | After OAuth | ✅ Was queued (audit 2026-07-09) |
| claimed | Worker claims | ❌ **Never** — attempts = 0 |
| running | Worker executes | ❌ Never |
| completed | Products synced | ❌ Never |
| Final state (2026-07-10) | — | **`cancelled`** at 00:06:43 UTC |

**Job ID:** `f3260095-2747-45a8-b4b8-4745b0ddab21`  
**Store:** `7f1a9df7-d3db-45a1-9a59-a12155f371a1`

---

## Execution Path Trace

```
OAuth (afterAuth) ✅
  → enqueue bootstrap_products ✅ (DB row created)
  → onboarding progressPercent=33, productSyncStatus=running ✅
  → worker claim ❌ BLOCKED HERE
  → Shopify product sync ❌ (never reached)
  → knowledge / graph / learning ❌ (never reached)
  → dashboard data ❌ (0 products)
```

**Failure point:** Between **enqueue** and **claimNextJob** — no worker process or authorized cron cycle processed the job before cancellation.

---

## Vercel Cron Fallback vs Continuous Worker

| Path | Status |
|------|--------|
| Railway continuous worker | ❌ Not running |
| Vercel cron `/cron/worker` | ⚠️ Scheduled daily; **last execution not verified** |
| Manual GET without auth | Returns health JSON only — **does not run cycle** |

See [CRON_VERIFICATION.md](./CRON_VERIFICATION.md).

---

## Issue W-1: No Worker Infrastructure

| Field | Value |
|-------|-------|
| Severity | **Critical** |
| Location | Production deployment |
| Root Cause | No continuous worker; cron insufficient |
| Evidence | activeWorkers: 0; job cancelled with attempts: 0 |
| Risk | 100% install failure |
| Recommended Fix | Deploy Railway worker OR Vercel Pro + */2 cron; re-enqueue bootstrap |
| Estimated Fix Time | 4–8 hours |
| Owner | DevOps |
| Verification | activeWorkers ≥ 1; job completes; products > 0 |

---

## Issue W-2: Cancelled Bootstrap With Stuck Onboarding

| Field | Value |
|-------|-------|
| Severity | **Critical** |
| Location | `sync_jobs` + `store_onboarding` |
| Root Cause | Job cancelled (source **not verified** — manual, uninstall partial, or reconciliation) while onboarding still `running` at 33% |
| Evidence | DB: status=cancelled, onboarding still "Syncing products" |
| Risk | Merchant permanently stuck; no auto-recovery |
| Recommended Fix | Reconcile onboarding + re-enqueue bootstrap (remediation phase) |
| Estimated Fix Time | 2 hours |
| Owner | Backend |
| Verification | Fresh install OR repair script reaches 100% |
