# RC5 Health Certification

**Date:** 2026-07-10  
**Phase:** RC5 — Health Certification  
**Status:** 🔴 **FAIL**

## Requirement

All endpoints must return **200** and healthy state.

## Evidence (production — pre-RC4 deploy)

**Timestamp:** 2026-07-10T10:22–10:23 UTC

| Endpoint | HTTP | Healthy | Result |
|----------|------|---------|--------|
| `/health` | **200** | ✅ | `{"ok":true,"mode":"liveness"}` |
| `/health/ready` | **503** | ❌ | migrations missing, prompts missing, scope drift |
| `/health/worker` | **503** | ❌ | `no_active_workers`, 0 active workers |
| `/health/monitor` | **503** | ❌ | worker check unhealthy |

## Root causes

1. Production deployment still on **`b1789a7`** — RC1 bundle not deployed
2. No Railway worker — `activeWorkers: 0`
3. Prompt files not in Vercel serverless bundle at `/var/task/`
4. Prisma migrations folder absent from serverless bundle path

## Commands used

```powershell
Invoke-WebRequest https://store-pilot-eta.vercel.app/health
Invoke-WebRequest https://store-pilot-eta.vercel.app/health/ready
Invoke-WebRequest https://store-pilot-eta.vercel.app/health/worker
Invoke-WebRequest https://store-pilot-eta.vercel.app/health/monitor
```

## Certification

**RC5: FAIL** — Stop. Complete RC4 deploy before re-testing.
