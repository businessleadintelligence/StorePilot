# RC6 Fresh Shopify Install Certification

**Date:** 2026-07-10  
**Phase:** RC6 — Fresh Install E2E  
**Status:** 🔴 **NOT EXECUTED**

## Stop condition

RC5 health gate **FAILED**. RC6 cannot proceed without healthy production deployment on commit **`baff5e5`**.

## Planned test (not run)

1. Create brand-new Shopify development store
2. Install StorePilot (no prior data)
3. Measure OAuth → bootstrap → 100% onboarding
4. Verify intelligence modules activate

## Prerequisites not met

| Prerequisite | Status |
|--------------|--------|
| RC4 Vercel deploy | ❌ |
| RC4 worker deploy | ❌ |
| RC4 migrations | ❌ |
| RC5 all health 200 | ❌ |
| `AI_PLATFORM_ENABLED=true` | ❌ |

## Certification

**RC6: NOT EXECUTED** — blocked by RC4/RC5.
