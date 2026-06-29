# StorePilot — Launch Blockers

**Date:** 2026-06-29  
**Status:** **6 ACTIVE BLOCKERS**

---

## LB-001 — Invalid Prisma Schema (Critical)

`schema.prisma` references `AiAgentRun`, `AiAgentResult`, `AiRecommendation`, `AiMemoryRecord`, `AiResultCacheEntry` but model definitions are **missing**. `npx prisma generate` fails with 5 validation errors.

**Fix:** Restore complete schema from last green commit; run `prisma generate` + `migrate deploy`.

---

## LB-002 — TypeScript Build Failure (Critical)

`npm run typecheck` fails — missing orchestrator, persistence, and empty fact modules (`executive-coo-facts.ts` is 0 bytes).

**Fix:** Complete or revert AI platform WIP files.

---

## LB-003 — Test Suite Majority Failing (Critical)

`npm test` → **72 failed** test files, **98 failed** tests.

**Fix:** Restore `createExecutiveCooFactsBuilder` and module graph.

---

## LB-004 — Production Routes Missing (Critical)

Missing routes: Command Center, Executive, Operations, Automation, Billing, System Health, Onboarding. Nav shows only Dashboard, Issues, Timeline, Recommendations, Reports, Settings.

**Fix:** Restore route files and `app.tsx` navigation.

---

## LB-005 — Shopify App Configuration Drift (High)

`shopify.app.toml` missing `read_orders`, order/billing/GDPR webhooks; template placeholder landing page on Vercel.

**Fix:** Restore production TOML per `SHOPIFY_SCOPES_AND_WEBHOOKS.md`.

---

## LB-006 — Real Store E2E Not Executed (High)

Zero embedded-app scenarios executed on dev store (OAuth, webhooks, connectors, mutations, billing).

**Fix:** After LB-001–005, run full checklist in [REAL_STORE_TEST_RESULTS.md](./REAL_STORE_TEST_RESULTS.md).

---

## Gate

All Critical blockers must be **Verified** before re-validation. Recommendation must move to **READY** only when every phase has PASS/FAIL evidence (not BLOCKED).
