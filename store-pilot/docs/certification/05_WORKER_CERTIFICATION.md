# 05 — Worker Certification

**Date:** 2026-07-10T09:00Z  
**Status:** 🔴 **FAIL**

## Infrastructure

| Component | Status |
|-----------|--------|
| `Dockerfile.worker` | 🟢 Exists locally (untracked) |
| `railway.toml` | 🟢 Exists locally (untracked) |
| `scripts/worker.ts` | 🟢 Exists locally (untracked) |
| Railway deploy | 🔴 NOT VERIFIED |
| Vercel cron fallback | 🔴 Old schedule in prod (`0 1 * * *` per C.1); local `vercel.json` has `*/2 * * * *` not deployed |

## Live production evidence

```http
GET /health/worker → 503
```

C.1 DB evidence: `worker_instances` table **0 rows**, `activeWorkers: 0`.

## Local code verification

| Capability | Status | Evidence |
|------------|--------|----------|
| Claim loop | 🟢 | `worker.server.ts`, tests f37/f38 |
| Heartbeat | 🟢 | `job.server.ts` heartbeatJob |
| Stale release | 🟢 | `releaseStaleJobs` |
| markPhaseStarted | 🟢 | C.2 wired in worker |
| Graceful shutdown | 🟢 | `worker-graceful-shutdown.test.ts` |
| In-flight tracking | 🟢 | `trackInFlightJob` in worker.server.ts |

## NOT VERIFIED (requires Railway deploy)

- Worker process started
- Heartbeat updating in DB
- SIGTERM drain
- activeWorkers >= 1
- Job claim after fresh install
- Recovery after worker restart

## Required human action

```bash
railway up --service worker -d
curl https://store-pilot-eta.vercel.app/health/worker
# Expect: "activeWorkers": >= 1, "status": "healthy"
```

## Certification result

**NOT CERTIFIED**
