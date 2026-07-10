# RC4A Step 3 — Vercel CLI Verification

**Date:** 2026-07-10  
**Status:** 🟡 **PASS WITH CONDITIONS**  
**Deploy executed:** ⛔ **NO**

## CLI evidence

```bash
vercel --version    # 54.14.2
vercel whoami       # businessleadintelligence
vercel project ls   # store-pilot found
vercel env ls production
vercel inspect store-pilot-eta.vercel.app
```

| Check | Result |
|-------|--------|
| CLI installed | ✅ 54.14.2 |
| Authenticated | ✅ `businessleadintelligence` |
| Team | `businessleadintelligences-projects` |
| Project name | `store-pilot` |
| Local `.vercel/project.json` | ❌ Not linked in workspace |
| Production alias | `https://store-pilot-eta.vercel.app` |
| Node version (project) | **24.x** |
| Framework | React Router (via `@vercel/react-router`) |

## Build configuration

| Setting | Value |
|---------|-------|
| `vercel.json` buildCommand | `npm run build` |
| installCommand | `npm install` |
| Build script | `prisma generate && react-router build && node scripts/copy-vercel-prompts.mjs` |
| Output | React Router server + client bundles |
| Cron `/cron/worker` | `*/2 * * * *` ✅ |
| Health routes | Present in build (λ health, health.ready, health.worker, health.monitor) |

## Local build dry run

```bash
npm run build   # exit 0, ~26s
```

- Server bundle: **2,546.60 kB**
- Prompt copy: **"Copied AI prompt files into server build output"** ✅
- Vite warnings: informational dynamic-import notices only

## Current production deployment (baseline — OLD)

| Field | Value |
|-------|-------|
| Deployment ID | `dpl_CRpYj3J2fWo6xV9s68Ax61MMcRWq` |
| Status | Ready |
| Created | 2026-07-10 05:38 IST (~11h before dry run) |
| Git commit on prod | **Not `baff5e5`** (pre-RC1; `origin/main` still `b1789a7`) |
| Function size | ~9.53MB per λ |

## Production readiness failures (current — expected pre-deploy)

`/health/ready` → **503** with:
- `shopify_scope_drift:env_not_in_toml:...` (fixed in `baff5e5` via embedded scopes)
- `migrations: ENOENT ... /var/task/prisma/migrations` (fixed in `baff5e5` DB-only fallback)
- `missing_prompts:...` (fixed in `baff5e5` via copy script + path resolution)

## Gaps before RC4

| Gap | Severity |
|-----|----------|
| `AI_PLATFORM_ENABLED` not in Vercel env list | 🔴 Critical |
| Deploy not run | Expected (RC4A) |
| Local project not linked (`vercel link`) | 🟡 Low |

## Verdict

**PASS WITH CONDITIONS** — Build can succeed; production not yet on RC1 commit; env gap remains.
