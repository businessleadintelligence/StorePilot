# Worker Validation — Phase C

**Date:** 2026-07-10  
**Status:** ❌ **FAILED** — no active workers in production.

---

## Live Production Evidence

**Endpoint:** `GET https://store-pilot-eta.vercel.app/health/worker` (2026-07-10T00:50:58Z)

```json
{
  "ok": false,
  "status": "unhealthy",
  "queue": { "queued": 0, "claimed": 0, "running": 0, "deadLetter": 0, "cancelled": 1 },
  "workers": { "activeWorkers": 0, "staleWorkers": 0, "workers": [] },
  "alerts": ["no_active_workers"],
  "cronFallback": { "cronSecretConfigured": true, "queueEnabled": true }
}
```

Monitor report confirms: `worker` check **unhealthy**, message `no_active_workers`.

---

## Continuous Worker Verification

| Capability | Code exists | Prod verified |
|------------|-------------|---------------|
| Worker heartbeat | ✅ `worker-runtime.server.ts`, `worker-registry.server.ts` | ❌ No instances |
| Worker registration | ✅ DB `WorkerInstance` | ❌ Empty |
| Health endpoint | ✅ `/health/worker` | ✅ Returns unhealthy correctly |
| Worker metrics | ✅ In health response | ✅ `processMetrics.cyclesCompleted: 0` |
| Queue claiming | ✅ `claimNextJob()` SKIP LOCKED | ❌ Not exercised |
| Retry | ✅ `failJobWithClient` exponential backoff | ⚠️ Not observed |
| Dead-letter | ✅ `JobStatus.dead_letter` | ✅ 0 in queue |
| Graceful shutdown | ✅ SIGINT/SIGTERM in worker-runtime | ❌ N/A |
| Orphan recovery | ✅ `releaseStaleJobs` | ❌ Not observed |
| Visibility timeout | ✅ `JOB_LOCK_DURATION_MS` (default 300s) | ⚠️ Config only |
| Heartbeat updates | ✅ `withJobHeartbeat` 60s | ❌ Not observed |
| Job locking | ✅ `lockedBy`, `lockExpiresAt` | ❌ Not observed |

---

## Cron Fallback Worker

| Check | Result |
|-------|--------|
| CRON_SECRET configured | ✅ |
| Queue enabled | ✅ |
| Cron schedule deployed | ⚠️ **Once daily** (`0 1 * * *` in `vercel.json`) |
| Code expects | Every 2 minutes (`cron-scheduler.server.ts`) |

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Location** | `vercel.json` vs `vercel.pro.crons.json` |
| **Root Cause** | Vercel Hobby cron limit — worker cron reduced to daily |
| **Evidence** | `vercel.json` line 6; code schedule in `cron-scheduler.server.ts` |
| **Risk** | New installs wait up to 24h for first worker cycle |
| **Recommended Fix** | Railway continuous worker OR Vercel Pro + full cron schedule |
| **Estimated Fix Time** | 2–4 hours |
| **Owner** | DevOps |
| **Verification** | Jobs claimed within 5 min of install |

---

## Job Types — Code Coverage

From `prisma/schema.prisma` enum `JobType`:

| Job type | Handler | Prod queue state |
|----------|---------|------------------|
| bootstrap_products | ✅ worker.server.ts | Was `queued` (audit) |
| bootstrap_inventory | ✅ | Not reached |
| orders_historical | ✅ | Not reached |
| knowledge_ingest | ✅ | Not verified |
| knowledge_graph_build | ✅ | Not verified |
| learning_bootstrap | ✅ | Partial (sync afterAuth) |
| historical_intelligence | ✅ | Not verified |
| quick_wins_generate | ✅ | Not verified |
| executive_decision_generate | ✅ | Not verified |
| root_cause_generate | ✅ | Not verified |
| prediction_generate | ✅ | Not verified |
| experiment_generate | ✅ | Not verified |
| executive_coo_generate | ✅ | Not verified |
| merchant_intelligence_refresh | ✅ | Not verified |
| onboarding_bootstrap | ⚠️ Enum only | Unused in app code |

**Status transitions verified in code:** `queued` → `claimed` → `running` → `completed` | `retrying` | `dead_letter` | `cancelled`

**Prod observation:** 1 `cancelled` job in queue metrics (likely prior uninstall/test).

---

## Railway Worker Deployment

| Check | Result |
|-------|--------|
| Dockerfile.worker | ✅ Present |
| railway.toml | ❌ Absent |
| Deployment evidence | ❌ **Not found** — no active workers |

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Location** | Railway (undocumented deployment) |
| **Root Cause** | Worker service not running or never deployed |
| **Evidence** | `activeWorkers: 0` |
| **Risk** | Entire async platform non-functional |
| **Recommended Fix** | Deploy worker service; confirm heartbeat in `/health/worker` |
| **Estimated Fix Time** | 2–4 hours |
| **Owner** | DevOps |
| **Verification** | `activeWorkers >= 1`, jobs process after install |

---

## Worker Runtime Note

`Dockerfile.worker` uses `npm run worker` → `tsx scripts/worker.ts`. Production hardening docs recommend compiled JS — **Medium** severity, not blocking if tsx runs reliably.

---

## Verification Checklist

- [ ] `GET /health/worker` → `ok: true`
- [ ] Fresh install creates jobs that move to `completed`
- [ ] `throughputLastHour` > 0 after activity
- [ ] No jobs older than 10 min in `queued` (alert threshold)
- [ ] Dead-letter count stays 0 under normal operation
