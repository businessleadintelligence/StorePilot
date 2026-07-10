# RC4 Vercel Deployment Certification

**Date:** 2026-07-10  
**Phase:** RC4 — Production Deployment (Vercel)  
**Status:** 🔴 **NOT EXECUTED**

## Stop condition triggered

RC4 deploy was **not executed** in this session. Production remains on pre-RC1 commit **`b1789a7`**. RC1 artifact is committed locally at **`baff5e5`** with tag **`v1.0.0-rc1`** but **not pushed**.

## Current production evidence

```bash
vercel ls store-pilot --prod
```

| Age | Status | Notes |
|-----|--------|-------|
| 10h | **Error** | Latest deploy attempt failed (12s) |
| 10h | Ready | Prior deployment still serving traffic |
| 21h+ | Ready | Historical deploys |

**Production URL:** `https://store-pilot-eta.vercel.app`  
**Serving commit:** `b1789a7` (not `baff5e5`)

## Pre-deploy readiness checks (local)

| Check | Result |
|-------|--------|
| RC3 commit | ✅ `baff5e5` |
| RC3 tag | ✅ `v1.0.0-rc1` (local) |
| `npm run build` (RC1) | ✅ Pass |
| Prompt copy script | ✅ 14 prompts |
| Git push | ⛔ Not done |

## Required commands (not run)

```bash
git push origin main --tags
cd store-pilot
vercel --prod
# Verify deployment commit hash == baff5e5
```

## Production health (pre-deploy baseline)

| Endpoint | Status | Issue |
|----------|--------|-------|
| `/health` | 200 | Liveness OK |
| `/health/ready` | 503 | Missing migrations path, missing prompts, scope drift |
| `/health/worker` | 503 | `no_active_workers` |
| `/health/monitor` | 503 | Worker unhealthy |

**Readiness failure excerpt (2026-07-10T10:22:24Z):**
- `migrations`: `ENOENT ... /var/task/prisma/migrations`
- `foundation_prompt_registry`: all 13 prompts missing
- `shopify_scope_drift`: env/TOML mismatch

These failures confirm **old bundle** is live — RC4 deploy required.

## Certification

**RC4 Vercel: FAIL / NOT EXECUTED** — Deploy blocked until `git push` + `vercel --prod` authorized.
