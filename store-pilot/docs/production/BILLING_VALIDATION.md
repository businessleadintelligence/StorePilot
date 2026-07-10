# Billing Validation — Phase C

**Date:** 2026-07-10  
**Status:** ✅ **PASS (architecture)** / ⚠️ **Unverified (live Shopify charges)**

---

## Single Source of Truth

| Layer | SSOT | Status |
|-------|------|--------|
| Plans, features, limits, pricing | `app/billing/plan-registry.ts` | ✅ Canonical |
| Legacy compat | `app/billing/plan-config.ts` | ✅ Thin wrapper only |
| Website pricing API | `app/billing/website-pricing.server.ts` → `/api/pricing` | ✅ Verified live |
| Entitlements | `app/billing/feature-gates.server.ts` | ✅ Code + tests |
| DB seed | `buildDbPlanSeedRecords()` from registry | ✅ |
| Shopify billing | `app/billing/shopify-billing.server.ts` | ✅ Uses registry slugs |

**Live pricing API (2026-07-10):**

```
GET /api/pricing → 200
Plans: starter ($29), growth ($79), scale ($199)
trialDays: 3, primaryPlanSlug: growth
Legacy pro/agency → mapped to scale in registry
```

---

## Public Plans

| Slug | Monthly | Active (expected) |
|------|---------|-------------------|
| starter | $29 | ✅ |
| growth | $79 | ✅ (primary) |
| scale | $199 | ✅ |
| pro | — | Legacy → scale |
| agency | — | Legacy → scale |

---

## Synchronization Matrix

| Surface | Source | Verified |
|---------|--------|----------|
| plan-registry.ts | SSOT | ✅ Static |
| Database `Plan` rows | Seed/migration | ⚠️ Not queried in Phase C |
| Shopify subscription | API + webhooks | ⚠️ Not live-tested |
| Dashboard billing UI | `/app/billing` | ⚠️ UI not browser-tested |
| Feature gates | `isFeatureAvailable()` | ✅ 3033 tests pass |
| Upgrade modal | `FeatureGate.tsx` | ⚠️ Not browser-tested |

---

## Billing Flows

| Flow | Code | Prod verified |
|------|------|---------------|
| Trial (3 days) | `GLOBAL_TRIAL_DAYS` in registry | ⚠️ |
| Upgrade | shopify-billing.server | ⚠️ |
| Downgrade | shopify-billing.server | ⚠️ |
| Cancel | terminate on uninstall | ✅ Code |
| Usage limits | billing-limits.ts | ✅ Tests |
| AI budget | plan limits `ai_requests` | ✅ Code |
| BILLING_TEST_MODE | env flag | ⚠️ Not in Vercel env list — assume off |

---

## Issues

### B-1: Live Shopify Charge Not Verified

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Location** | Production Shopify Billing API |
| **Root Cause** | Phase C did not execute test charge on dev store |
| **Evidence** | No billing API call logs collected |
| **Risk** | Charge acceptance flow may fail at App Review |
| **Recommended Fix** | Install on dev store → accept Growth trial → verify `app_subscriptions/update` webhook |
| **Estimated Fix Time** | 1 hour |
| **Owner** | QA / Merchant ops |
| **Verification** | Subscription row in DB matches Shopify |

### B-2: DB Plan Rows Not Re-Queried

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Location** | Supabase production |
| **Root Cause** | Phase C read-only; no DB access in this run |
| **Evidence** | Prior billing unification reported 3 active plans |
| **Risk** | Stale inactive legacy plans if migration not applied |
| **Recommended Fix** | `SELECT slug, active, price FROM "Plan"` on production |
| **Estimated Fix Time** | 15 min |
| **Owner** | DevOps |
| **Verification** | Only starter/growth/scale active |

---

## Duplication Check

- ❌ No duplicate price tables outside registry (post unification sprint)
- ✅ `/api/pricing` matches registry (live probe)

**Conclusion:** Billing architecture is **launch-ready**; **operational billing flows require live merchant test**.
