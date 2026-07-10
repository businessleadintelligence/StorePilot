# Phase C.2 — Production Launch Remediation (Implementation)

**Date:** 2026-07-10  
**Status:** Code complete — deployment & E2E verification pending  
**Production URL:** https://store-pilot-eta.vercel.app

## Mission

Ensure a fresh Shopify merchant install reaches **100% onboarding automatically** with production-ready queue, worker, health, and UI truth.

## Summary of Changes

| Part | Status | Key deliverable |
|------|--------|-----------------|
| 1 Queue lifecycle | ✅ Code | Idempotency + terminal job repair; cancellation traced |
| 2 Worker infra | ✅ Code | `markPhaseStarted` wired; Railway config added |
| 3 Cron | ✅ Config | `vercel.json` worker cron → `*/2 * * * *` (fallback) |
| 4 Bootstrap pipeline | ✅ Code | Queued at enqueue; % only after phase complete |
| 5 Dashboard FSM | ✅ Code | Pipeline states derived from job + phase |
| 6 Prompt runtime | ✅ Code | Vercel bundle path resolution + copy script |
| 7 app/uninstalled | ✅ Code | Canonical `handleAppUninstalledWebhook()` |
| 8 Railway | ✅ Config | `railway.toml` + `Dockerfile.worker` |
| 9 E2E verification | ⏳ Pending | Requires deploy + fresh dev store install |
| 10 Production health | ⏳ Pending deploy | Scope drift + prompts fixed in code |
| 11 Monitoring | ✅ Code | Cancelled bootstrap + queue alerts |
| 12 Acceptance tests | ✅ Local | 3033/3033 tests pass |

## Files Created

- `app/lib/shopify-app-config.ts` — embedded canonical scopes
- `app/services/onboarding-display-state.server.ts` — pipeline FSM
- `railway.toml` — worker service config
- `docs/remediation/*.md` — this documentation set

## Files Modified (core)

- `app/services/onboarding.server.ts` — queue truth, repair, progress
- `app/services/job.server.ts` — `isTerminalJobStatus`, cancel includes `claimed`
- `app/services/worker.server.ts` — calls `markPhaseStarted` after claim
- `app/services/onboarding-ui.server.ts` — job-aware loader
- `app/routes/webhooks.app.uninstalled.tsx` — canonical handler
- `app/services/scope-drift-monitor.server.ts` — embedded scope fallback
- `app/ai/foundation/prompt-registry/store.ts` — Vercel path candidates
- `scripts/copy-vercel-prompts.mjs` — flat + hashed bundle copy
- `vercel.json` — cron fallback every 2 minutes
- `app/components/SyncStatusCard.tsx` — Queued/Claimed/Running badges
- `app/lib/sync-display.ts`, `app/lib/onboarding-display.ts`

## Test Evidence

```
Test Files  280 passed (280)
Tests       3033 passed (3033)
```

## Remaining Exit Criteria (require deploy)

1. Deploy Vercel + Railway worker
2. `GET /health/worker` → `activeWorkers >= 1`
3. Fresh install → 100% without manual steps
4. All health endpoints green in production

See individual reports in this folder for details.
