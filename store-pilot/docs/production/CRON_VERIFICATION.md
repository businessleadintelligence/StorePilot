# Cron Verification — Phase C.1

**Date:** 2026-07-10  
**Verification methods:** `vercel crons ls`, repo files, runtime endpoint, Vercel documentation

---

## The Truth: Three Cron Sources

| Source | Worker schedule | Status |
|--------|-----------------|--------|
| `app/services/cron-scheduler.server.ts` | `*/2 * * * *` | Code canonical — **not deployed** |
| `vercel.pro.crons.json` | `*/2 * * * *` | Pro-tier template — **not deployed** |
| **`vercel.json` (deployed)** | **`0 1 * * *`** | **Verified via `vercel crons ls`** |

---

## Deployed Production Crons (Verified via deployment)

```
vercel crons ls — businessleadintelligences-projects/store-pilot
2026-07-10
```

| Path | Schedule (UTC) |
|------|----------------|
| `/cron/worker` | **0 1 * * *** (daily 01:00) |
| `/cron/dispatch/cleanup-jobs` | 0 2 * * * |
| `/cron/dispatch/knowledge-refresh` | 0 3 * * * |
| `/cron/dispatch/learning-engine` | 0 4 * * * |
| `/cron/dispatch/daily-operating-plan` | 0 6 * * * |

**Not deployed:** retry-queue, expired-sessions, metrics-aggregation, recommendation-refresh, privacy-pii-scan, scope-drift-monitor, token-migration

---

## Is Vercel Cron the Production Execution Path?

**Answer: Yes — it is the ONLY verified execution path.** No Railway/Docker worker evidence exists.

| Path | Role |
|------|------|
| **Vercel cron** | Primary (only) async job trigger in production |
| Railway worker | Expected architecture per docs — **not verified deployed** |
| Manual invocation | Requires `CRON_SECRET` via `Authorization: Bearer` or `x-cron-secret` |

---

## Cron Authentication (Verified via code + Vercel docs)

- `CRON_SECRET` **present** in Vercel production env (verified via `vercel env ls`)
- Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on cron invocations (Vercel docs — **not verified via logs in this phase**)
- `app/routes/cron.worker.tsx` loader: authorized GET **runs** `runWorkerCycle()`

### Unauthenticated probe (Verified via runtime endpoint)

```
GET https://store-pilot-eta.vercel.app/cron/worker
→ 200 {"success":true,"health":{"cronSecretConfigured":true,"queueEnabled":true}}
```

**Does NOT execute worker cycle** — returns health JSON only when unauthorized.

---

## Cron Execution History

| Field | Status |
|-------|--------|
| Last execution timestamp | **Not Verified** — requires Vercel dashboard logs |
| Next execution timestamp | **Inferred:** daily 01:00 UTC — not confirmed by Vercel API |
| CRON_SECRET validation on cron invoke | **Not Verified** — requires Vercel cron logs |

---

## Timeline Analysis (Bootstrap job vs cron)

| Event | Timestamp (UTC) |
|-------|-----------------|
| Bootstrap job created | 2026-07-09 12:19:02 |
| Bootstrap job **cancelled** | 2026-07-10 00:06:43 |
| Next daily cron (inferred) | 2026-07-10 01:00:00 |

If cron ran at 01:00 UTC on Jul 10, the bootstrap job was **already cancelled** — worker cycle would have **nothing to process** for that store.

---

## Architecture Documentation

### Current (verified)

```
Install → enqueue job → [wait up to 24h] → Vercel cron GET /cron/worker (with Bearer)
         → runWorkerCycle (ephemeral, not registered as WorkerInstance)
```

Note: Cron worker uses ID `cron-worker-${timestamp}` — may not persist in `worker_instances` table the same way as continuous worker.

### Expected (documented)

```
Install → enqueue → Railway continuous worker (heartbeat in worker_instances)
                 OR Vercel Pro cron every 2 minutes
```

### Fallback (verified partial)

Daily Vercel cron at 01:00 UTC — insufficient for near-real-time onboarding.

---

## Issue C-1: Cron Schedule Inadequate

| Field | Value |
|-------|-------|
| Severity | Critical |
| Location | `vercel.json` |
| Root Cause | Hobby-tier compromise: worker cron daily not every 2 min |
| Evidence | `vercel crons ls` vs `cron-scheduler.server.ts` |
| Impact | Up to 24h before first job run |
| Fix | Vercel Pro + `vercel.pro.crons.json` OR Railway worker |
| Verification | Cron log shows execution; jobs claimed within 5 min of install |

## Issue C-2: Cron Execution Not Proven

| Field | Value |
|-------|-------|
| Severity | High |
| Location | Vercel observability |
| Root Cause | No log access in Phase C.1 |
| Evidence | Job never ran (attempts=0) despite CRON_SECRET present |
| Fix | Pull Vercel cron invocation logs for Jul 9–10 |
| Verification | Log entry for `/cron/worker` with 200 + processed job |
