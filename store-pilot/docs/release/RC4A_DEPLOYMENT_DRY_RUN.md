# RC4A — Production Deployment Dry Run

**Date:** 2026-07-10  
**Mission:** Complete rehearsal of RC4 deployment **without** deploying, pushing, migrating, or modifying production  
**Result:** 🟡 **READY WITH CONDITIONS**  
**Score:** **58/100**

---

## Rules compliance

| Rule | Status |
|------|--------|
| No Vercel deploy | ✅ |
| No Railway deploy | ✅ |
| No GitHub push | ✅ |
| No new tags | ✅ |
| No production DB changes | ✅ |
| No env changes | ✅ |
| No Shopify installs | ✅ |
| No live migrations | ✅ |

---

## Step reports

| Step | Report | Verdict |
|------|--------|---------|
| 1 Git | [RC4A_GIT_VERIFICATION.md](./rc4a/RC4A_GIT_VERIFICATION.md) | 🟡 Pass w/ conditions |
| 2 GitHub | [RC4A_GITHUB_VERIFICATION.md](./rc4a/RC4A_GITHUB_VERIFICATION.md) | 🟡 Pass w/ conditions |
| 3 Vercel | [RC4A_VERCEL_VERIFICATION.md](./rc4a/RC4A_VERCEL_VERIFICATION.md) | 🟡 Pass w/ conditions |
| 4 Railway | [RC4A_RAILWAY_VERIFICATION.md](./rc4a/RC4A_RAILWAY_VERIFICATION.md) | 🔴 Fail |
| 5 Docker | [RC4A_DOCKER_CERTIFICATION.md](./rc4a/RC4A_DOCKER_CERTIFICATION.md) | 🔴 Fail |
| 6 Prisma | [RC4A_PRISMA_CERTIFICATION.md](./rc4a/RC4A_PRISMA_CERTIFICATION.md) | ✅ Pass |
| 7 Prompts | [RC4A_PROMPT_CERTIFICATION.md](./rc4a/RC4A_PROMPT_CERTIFICATION.md) | ✅ Pass (local) |
| 8 Environment | [RC4A_ENVIRONMENT_AUDIT.md](./rc4a/RC4A_ENVIRONMENT_AUDIT.md) | 🔴 Fail |
| 9 Configuration | [RC4A_CONFIGURATION_AUDIT.md](./rc4a/RC4A_CONFIGURATION_AUDIT.md) | ✅ Pass |
| 10 Rollback | [RC4A_ROLLBACK_CERTIFICATION.md](./rc4a/RC4A_ROLLBACK_CERTIFICATION.md) | ✅ Pass |
| 11 Dependencies | [RC4A_DEPENDENCY_AUDIT.md](./rc4a/RC4A_DEPENDENCY_AUDIT.md) | 🟡 Pass w/ conditions |
| 12 Rehearsal | [RC4A_DEPLOYMENT_REHEARSAL.md](./rc4a/RC4A_DEPLOYMENT_REHEARSAL.md) | ✅ Complete |
| 13 Final | [RC4A_FINAL_CERTIFICATION.md](./rc4a/RC4A_FINAL_CERTIFICATION.md) | 🟡 Ready w/ conditions |

---

## Key evidence snapshot

### Release artifact

| Field | Value |
|-------|-------|
| Deploy commit | `baff5e52a14502a16d9568ed2f891493bb78d50d` |
| Tag | `v1.0.0-rc1` (local) |
| Remote main | `b1789a714169eb1603c6e5080ba309718bede833` |
| Pending push | 2 commits + 1 tag |

### Build gates (2026-07-10)

```
npm run typecheck  → exit 0
npm run lint       → exit 0
npm run build      → exit 0, 14 prompts copied
```

### Production baseline (unchanged)

```
GET /health       → 200
GET /health/ready → 503 (prompts, migrations FS, scope drift)
GET /health/worker → 503 (no_active_workers)
```

### Environment gap

```
AI_PLATFORM_ENABLED → NOT in Vercel production env list
```

---

## Deployment recommendation

# 🟡 READY WITH CONDITIONS

Proceed to **RC4 Production Deployment** only after:

1. Push `main` + `v1.0.0-rc1`
2. Add `AI_PLATFORM_ENABLED=true` (Vercel + Railway)
3. Link Railway project and verify worker service
4. Prove Docker/Railway build
5. Execute RC4 deploy sequence with RC5 health gate

---

## What RC4A discovered (would have failed blind deploy)

1. **Git push forgotten** — Vercel would rebuild old `b1789a7` without push
2. **AI platform disabled** — Executive COO / explanations stay on deterministic fallback
3. **Worker never verified** — Railway link missing; `/health/worker` would stay 503
4. **Docker untested** — First worker image build risk unknown
5. **Current prod failures are pre-RC1** — RC1 code fixes prompts/scope/migration checks but requires deploy

---

**No production systems were modified during RC4A.**
