# StorePilot v1.0.0-rc1 Release Notes

**Release Candidate:** RC1  
**Date:** 2026-07-10  
**Base commit (current HEAD):** `b1789a7`  
**Target tag (prepared, not applied):** `v1.0.0-rc1`

---

## Overview

StorePilot v1.0.0-rc1 is the first Release Candidate of the feature-complete intelligence platform. This RC focuses exclusively on **stabilization** — no new product features, no architecture redesign.

RC1 resolves ~120 TypeScript errors and ~92 ESLint issues while preserving all intelligence modules and existing behavior.

---

## Quality gates

| Gate | Status |
|------|--------|
| TypeScript (0 errors) | ✅ PASS |
| ESLint (0 errors, 0 warnings) | ✅ PASS |
| Tests (3033/3033) | ✅ PASS |
| Production build | ✅ PASS (Vite informational warnings) |
| Repository clean | 🔴 FAIL — 281 uncommitted paths |
| Bundle verification | ✅ PASS |

---

## Stabilization highlights

### Intelligence workspace

- Unified type definitions in `intelligence-workspace-types.ts`
- Eliminated duplicate exports causing ~120 TypeScript errors
- Preserved all workspace loaders and views without behavior change

### Knowledge & learning barrels

- Resolved duplicate export conflicts in `app/knowledge/index.ts` and `app/learning/index.ts`
- Explicit named exports where `export *` caused symbol collisions

### Phase C.2 remediation (included, uncommitted)

- Onboarding queue idempotency and progress truthfulness
- Worker phase tracking and terminal job repair
- Webhook uninstall canonical handler
- Health / prompt registry fixes for production bundle
- Railway worker infrastructure (`Dockerfile.worker`, `railway.toml`)

### Test infrastructure

- Knowledge graph test mocks refactored with typed `mockPrismaMethod()` helper
- Removed `@ts-nocheck` from test sources

---

## Database migrations (12 new — apply before deploy)

Apply in timestamp order via `prisma migrate deploy`:

1. `20260709160000_ai_platform_foundation`
2. `20260709183000_knowledge_ingestion_platform`
3. `20260709210000_knowledge_graph_platform`
4. `20260709220000_learning_bootstrap_platform`
5. `20260709230000_historical_intelligence_engine`
6. `20260709240000_quick_wins_engine`
7. `20260710000000_executive_decision_engine`
8. `20260710010000_root_cause_engine`
9. `20260710020000_prediction_prevention_engine`
10. `20260710030000_experiment_intelligence_platform`
11. `20260710040000_merchant_intelligence_platform`
12. `20260710120000_privacy_hardening`
13. `20260710130000_billing_unification`

---

## Environment requirements

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes | Supabase / Postgres |
| `SHOPIFY_*` | yes | App credentials |
| `AI_PLATFORM_ENABLED` | yes | Must be `true` in production |
| Worker env mirror | yes | Railway service must match Vercel |

---

## Known issues / deferred

- Production currently deployed at `b1789a7` — RC1 fixes not yet live
- `/health/ready`, `/health/worker`, `/health/monitor` return 503 in production (no worker deployed)
- Vite dynamic-import bundler warnings (non-fatal)
- Prisma `package.json#prisma` deprecation warning
- Git working tree requires authorized commit before tag

---

## Upgrade / install

No public upgrade path — RC1 is internal. Deployment sequence:

1. Review and commit RC1 changes
2. Tag `v1.0.0-rc1`
3. `prisma migrate deploy` on production
4. Deploy Vercel + Railway worker
5. Verify health endpoints
6. Fresh Shopify install E2E test

See [DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md).

---

## What is NOT in this RC

- No new product features
- No architecture simplification
- No intelligence module removal
- No automatic commit, push, tag, or deploy

---

## Sign-off prerequisite

RC1 is ready for **human review and authorized commit**. Deployment begins only after RC1 approval.
