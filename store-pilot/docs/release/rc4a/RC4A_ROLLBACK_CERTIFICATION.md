# RC4A Step 10 — Rollback Certification

**Date:** 2026-07-10  
**Source:** `docs/release/ROLLBACK_PLAN.md`  
**Status:** ✅ **PASS**

## Procedures verified

| Component | Documented | Evidence |
|-----------|------------|----------|
| Vercel rollback | ✅ `vercel rollback` | Known good: `b1789a7` |
| Railway worker rollback | ✅ `railway rollback` | Dashboard fallback documented |
| Database rollback | ✅ Forward-only + Supabase PITR | No down-migrations |
| Env rollback | ✅ Vercel env history | Documented |
| Git rollback | 🟡 Implicit (re-promote old deploy) | Tag `v1.0.0-rc1` is new baseline |

## Timing targets

| Component | RTO |
|-----------|-----|
| Vercel app | < 5 min |
| Railway worker | < 10 min |
| Database PITR | < 1 hr |

## Rollback triggers (documented)

- `/health/ready` 503 > 15 min
- Fresh install bootstrap failure
- GDPR webhook failure
- sync_jobs / onboarding corruption

## Gaps

| Gap | Severity |
|-----|----------|
| RC1 rollback baseline should update to pre-RC1 deploy ID after RC4 | Low |
| Railway project not linked — rollback untested | Medium |

## Verdict

**PASS** — Rollback plan adequate for RC4; execute drill post-deploy.
