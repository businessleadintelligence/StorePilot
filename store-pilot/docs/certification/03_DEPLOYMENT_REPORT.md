# 03 — Deployment Report

**Date:** 2026-07-10T09:00Z  
**Status:** 🔴 **NOT DEPLOYED**

## Current production state

| Field | Value |
|-------|-------|
| URL | https://store-pilot-eta.vercel.app |
| Deployed commit | `b1789a7` — "Production installation verified" |
| Local HEAD | `b1789a7` (same commit, but **278 uncommitted local changes**) |
| Deploy executed this session | **No** |

## Why deploy was not executed

Git certification **FAIL** — deploying from dirty tree would not include Phase C.2 fixes. `vercel --prod` would deploy last pushed commit only.

## Health after current production deploy

| Endpoint | HTTP | ok | Timestamp |
|----------|------|-----|-----------|
| `/health` | 200 | true | 2026-07-10T08:59:41Z |
| `/health/ready` | 503 | false | 2026-07-10T08:59:41Z |
| `/health/worker` | 503 | false | 2026-07-10T08:59:41Z |
| `/health/monitor` | 503 | false | 2026-07-10T08:59:41Z |

### `/health/ready` failing checks (live)

- `shopify_scope_drift` — toml missing on serverless
- `migrations` — `/var/task/prisma/migrations` ENOENT
- `foundation_prompt_registry` — 13 prompts missing

**Fixed in local C.2 code — not deployed.**

## Required human action

1. Complete Git certification (commit + push)
2. `vercel --prod`
3. Record deployment URL and commit hash from Vercel dashboard
4. Re-run health checks

## Verification commands

```bash
vercel ls store-pilot --prod
curl -s https://store-pilot-eta.vercel.app/health/ready | jq .
```

## Certification result

**NOT VERIFIED** — deployment of certification release not performed.
