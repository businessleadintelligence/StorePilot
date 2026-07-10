# RC4 Railway Worker Deployment Certification

**Date:** 2026-07-10  
**Phase:** RC4 — Railway Worker  
**Status:** 🔴 **NOT EXECUTED**

## Evidence (production probe)

```http
GET https://store-pilot-eta.vercel.app/health/worker
503
```

```json
{
  "ok": false,
  "status": "unhealthy",
  "workers": { "activeWorkers": 0, "workers": [] },
  "alerts": ["no_active_workers"],
  "queue": { "cancelled": 1 }
}
```

## Local package readiness

| Artifact | Status |
|----------|--------|
| `Dockerfile.worker` | ✅ In commit `baff5e5` |
| `railway.toml` | ✅ In commit |
| `scripts/worker.ts` | ✅ In commit |
| `app/services/worker.server.ts` | ✅ Phase C.2 fixes included |

## Required commands (not run)

```bash
git push origin main --tags
railway up --service worker -d
# Verify heartbeat in /health/worker
```

## Verification checklist (pending)

| Check | Status |
|-------|--------|
| Worker online | 🔴 0 active workers |
| Heartbeat active | 🔴 Not verified |
| Worker registration | 🔴 Empty registry |
| Queue polling | 🟡 Cron fallback configured |
| Graceful shutdown | ⛔ Not tested in prod |

## Certification

**RC4 Worker: FAIL / NOT EXECUTED**
