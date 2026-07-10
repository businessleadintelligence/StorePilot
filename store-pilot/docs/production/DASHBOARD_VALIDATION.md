# Dashboard Validation — Phase C

**Date:** 2026-07-10  
**Status:** ⚠️ **PARTIAL** — UI upgraded; data-dependent widgets unverified with live merchant data.

---

## Main Dashboard (`/app`)

**Route:** `app/routes/app._index.tsx`  
**Loader:** Fetches onboarding, sync, metrics, health, brief, insights, recommendations, intelligence sections.

### Widgets / Cards

| Widget | Loader data | Empty state | Loading | Error | Prod data |
|--------|-------------|-------------|---------|-------|-----------|
| Premium Hero | metrics, healthScore | ✅ | N/A (SSR) | Graceful nulls | ⚠️ Empty if no sync |
| Intelligence workspaces | static routes | ✅ | N/A | N/A | ✅ Links defined |
| Learning bootstrap | learningBootstrap | Hidden if !showOnboarding | N/A | Null | ⚠️ Depends on sync |
| Quick wins | quickWins | Hidden if null | N/A | Null | ❌ No worker data |
| Executive intelligence | executiveDashboard | Hidden if null | N/A | Null | ❌ |
| Root cause | rootCause | Hidden if null | N/A | Null | ❌ |
| Predictions | prediction | Hidden if null | N/A | Null | ❌ |
| Experiments | experiments | Hidden if null | N/A | Null | ❌ |
| Merchant intelligence | merchantIntelligence | Hidden if null | N/A | Null | ❌ |
| Sync status | syncStatus | Hidden if null | N/A | Null | ⚠️ Shows misleading progress |
| Metrics overview | metrics | Hidden if null | N/A | Null | ❌ 0 products |
| Health score | healthScore | Hidden if null | N/A | Null | ⚠️ Low/empty scores |
| Executive brief | executiveBrief | Hidden if null | N/A | Null | ⚠️ |
| Insights | insights | ✅ empty state | N/A | Null | ✅ |
| Recommendations | recommendations | ✅ empty state | N/A | Null | ✅ |
| Aside: platform/shopify/setup | static + onboarding | ✅ | N/A | N/A | ✅ |

**Note:** Premium UI redesign completed; bland placeholder sections removed.

---

## Workspace Routes (Click Targets)

From `app/intelligence-ui/constants.ts` — `WORKSPACE_ROUTES`:

| Link | Path | Route file | Verified |
|------|------|------------|----------|
| Executive | `/app/executive` | `app.executive.tsx` | ✅ Exists |
| Inventory | `/app/inventory` | `app.inventory.tsx` | ✅ |
| Pricing | `/app/pricing` | `app.pricing.tsx` | ✅ |
| Knowledge Graph | `/app/knowledge-graph` | `app.knowledge-graph.tsx` | ✅ |
| Business Memory | `/app/business-memory` | `app.business-memory.tsx` | ✅ |
| Timeline | `/app/timeline` | `app.timeline.tsx` | ✅ |
| Root Causes | `/app/root-causes` | `app.root-causes.tsx` | ✅ |
| Predictions | `/app/predictions` | `app.predictions.tsx` | ✅ |
| Experiments | `/app/experiments` | `app.experiments.tsx` | ✅ |
| Merchant Profile | `/app/merchant-intelligence` | `app.merchant-intelligence.tsx` | ✅ |
| Executive COO | `/app/coo` | `app.coo.tsx` | ✅ (not redesigned per scope) |
| Billing | `/app/billing` | `app.billing.tsx` | ✅ |
| Settings | `/app/settings` | `app.settings.tsx` | ✅ |

**Dead link scan:** No broken route files for dashboard workspace cards. **Browser navigation not executed in Phase C.**

---

## Trial vs Paid States

| State | Mechanism | Verified |
|-------|-----------|----------|
| Trial | `GLOBAL_TRIAL_DAYS = 3`, billing service | ⚠️ Code only |
| Paid | Shopify subscription + entitlements | ⚠️ Code only |
| Feature gates | `FeatureGate.tsx` | ✅ Tests |

---

## APIs Used by Dashboard

| API | Endpoint | Live |
|-----|----------|------|
| Pricing (marketing) | `/api/pricing` | ✅ 200 |
| Dashboard loader | `/app` SSR | ✅ 200 (assumed via app) |
| Health | `/health` | ✅ |

---

## Issues

### D-1: Dashboard Shows Intelligence With No Backend Data

| Field | Value |
|-------|-------|
| **Severity** | High (symptom of worker failure) |
| **Location** | Dashboard loaders |
| **Root Cause** | Worker never populated intelligence tables |
| **Evidence** | Bootstrap audit — 0 products; worker unhealthy |
| **Risk** | Empty/premium shell confuses merchants |
| **Recommended Fix** | Fix worker first; empty states already present |
| **Estimated Fix Time** | Depends on worker fix |
| **Owner** | Platform |
| **Verification** | Post-install dashboard shows real metrics |

### D-2: SyncStatusCard Progress Inconsistent

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Location** | `SyncStatusCard.tsx` — hardcoded setupProgress |
| **Root Cause** | Does not use DB `onboarding.progressPercent` |
| **Evidence** | Code review |
| **Risk** | Sidebar shows 58% while main onboarding shows 33% |
| **Recommended Fix** | Use single progress source from loader |
| **Estimated Fix Time** | 1 hour |
| **Owner** | Frontend |
| **Verification** | All progress UI matches DB |

---

## Graphs & Interactions

| Element | Type | Status |
|---------|------|--------|
| Mini sparklines | Metrics, quick wins | ✅ UI |
| Progress rings | Health, learning | ✅ UI |
| Intelligence gauges | Executive, prediction cards | ✅ When data exists |
| Hover animations | Premium CSS | ✅ |

**Conclusion:** Dashboard **UX ready**; **data completeness blocked by worker/onboarding**.
