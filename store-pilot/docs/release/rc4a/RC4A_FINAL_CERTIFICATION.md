# RC4A Final Certification

**Program:** RC4A — Production Deployment Dry Run  
**Date:** 2026-07-10  
**Deploy / push / migrate executed:** ⛔ **NONE**

---

## Executive summary

RC4A completed a full **read-only** rehearsal of the RC4 production deployment. The **RC1 artifact** (`baff5e5`, tag `v1.0.0-rc1`) is locally correct and builds successfully. **Production has not been touched.** Current live deployment remains on **`b1789a7`** with expected health failures (missing prompts, scope drift, no worker).

**Critical gaps before RC4:** git push, `AI_PLATFORM_ENABLED`, Railway project link/worker verification, Docker build proof.

---

## Overall readiness score

### **58 / 100**

| Category | Weight | Score |
|----------|--------|-------|
| Git / GitHub | 15% | 70 |
| Vercel readiness | 20% | 65 |
| Railway / Docker | 20% | 25 |
| Database / Prisma | 15% | 90 |
| Prompts / config | 15% | 85 |
| Environment | 15% | 40 |

---

## Deployment recommendation

# 🟡 READY WITH CONDITIONS

**NOT** `READY FOR RC4 DEPLOYMENT` until conditions below are cleared.

---

## Critical blockers

| # | Blocker | Evidence |
|---|---------|----------|
| 1 | Git not pushed (`baff5e5`, tag `v1.0.0-rc1`) | `origin/main` = `b1789a7`; ahead 2 |
| 2 | `AI_PLATFORM_ENABLED` missing on Vercel | `vercel env ls production` |
| 3 | Railway not linked — worker path unverified | `railway status` |
| 4 | Docker worker build not proven | Daemon not running |

---

## High risks

| Risk | Mitigation |
|------|------------|
| First deploy of 657-file delta | Staged deploy; monitor Vercel build logs |
| Worker never ran in production | Deploy Railway; verify `/health/worker` |
| Node 20 (Docker) vs 24 (Vercel) | Smoke-test worker after Railway build |
| Production health 503 today | Expected until RC4 deploy completes |

---

## Medium / low risks

| Risk | Level |
|------|-------|
| npm audit ajv moderate (transitive) | Medium |
| Parent repo untracked scratch files | Low |
| Prisma package.json deprecation | Low |
| Vite bundle warnings | Low |

---

## Missing evidence

- Railway env parity audit
- Docker build + worker container start
- Production post-deploy health (RC5)
- Fresh install E2E (RC6)

---

## Unknowns

- Which Railway project hosts StorePilot worker
- Whether production DB differs from `.env` target used in `migrate status`
- Vercel deployment git SHA binding after push

---

## Required table

| Area | Status | Evidence | Action |
|------|--------|----------|--------|
| Git branch/commit | 🟡 | `main` @ `444a967`; release `baff5e5` | Push in RC4 |
| Local tag | ✅ | `v1.0.0-rc1` → `baff5e5` | Push tag |
| Git clean (store-pilot) | ✅ | No modified tracked files | — |
| GitHub remote | ✅ | ls-remote OK | Push 2 commits |
| Vercel CLI/auth | ✅ | v54.14.2, authenticated | — |
| Vercel local build | ✅ | `npm run build` exit 0 | — |
| Vercel prod deploy | 🔴 | Still `b1789a7` era | `vercel --prod` in RC4 |
| Railway CLI/auth | ✅ | v5.23.3, authenticated | — |
| Railway project link | 🔴 | No linked project | `railway link` |
| Docker build | 🔴 | Daemon down | Build locally or on Railway |
| Prisma migrations | ✅ | 36/36, status up to date | `migrate deploy` in RC4 |
| Prompt bundle (local) | ✅ | 14/14, checksum match | Verify post-deploy |
| Prompt bundle (prod) | 🔴 | 13 missing on live | Deploy RC1 |
| Environment vars | 🔴 | `AI_PLATFORM_ENABLED` missing | Add before RC4 |
| Configuration files | ✅ | vercel/railway/docker aligned | — |
| Rollback plan | ✅ | Documented | Update baseline post-RC4 |
| Dependencies | 🟡 | Build OK; 3 moderate audit | Monitor |
| Typecheck/lint | ✅ | 0 errors | — |
| Health /health | 🟡 | 200 liveness only | RC5 after deploy |
| Health /ready | 🔴 | 503 pre-deploy | RC5 after deploy |
| Health /worker | 🔴 | 503, 0 workers | RC4 worker deploy |
| Health /monitor | 🔴 | 503 | RC5 after deploy |
| Fresh install | ⛔ | Not run (RC4A rule) | RC6 |
| Privacy live | ⛔ | Not run | RC8 |

---

## Conditions for RC4 GO

1. ✅ `git push origin main --tags`
2. ✅ `vercel env add AI_PLATFORM_ENABLED production` → `true`
3. ✅ `railway link` + confirm worker service + env mirror
4. ✅ Docker build succeeds (local or Railway)
5. ✅ `vercel --prod` from `baff5e5`
6. ✅ `railway up` worker
7. ✅ `prisma migrate deploy` (production URL)
8. ✅ RC5 all health 200

---

**Signed:** RC4A Dry Run — 2026-07-10
