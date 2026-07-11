# P2 Final Performance Certification

**Date:** 2026-07-11  
**Deploy SHA:** `6b6b154`  
**Production:** https://store-pilot-eta.vercel.app  
**Sprint:** P2 Route-Level Performance Optimization

---

## Implemented (deployed)

1. **Deferred workspace shell** — workspace core renders first; `globalSearch` + `unifiedTimeline` resolve in background via `DeferredShellWorkspace`
2. **Loader instrumentation** — categorized `loader_section_timing` (`auth`, `database`, `billing`, `cache`) on all workspace routes, Billing, Settings
3. **Settings + Billing** — migrated to `resolveRequestStoreContext` + timed parallel sections
4. **Query deduplication** — Executive decisions, Root Cause, Predictions (single fetch reused for UI mapping)
5. **Query limits** — executive decisions (50), operations queue (30), pattern seeds (25)
6. **Products pagination** — 25/page default, URL `?page=` / `?pageSize=` (20–50)
7. **Inventory domain lists** — take 20 per entity type; no full-table fetch
8. **Knowledge Graph** — persisted statistics via `getGraphStatisticsForLoader` (<5 min TTL)
9. **Progressive rendering** — Phase 1 shell/title/actions → Phase 2 workspace core → Phase 3 charts → Phase 4 PDE insights (deferred)

---

## Engineering gate

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ Pass |
| `npm run lint` | ✅ Pass |
| `npm test` | ✅ 3042/3042 |
| `npm run build` | ✅ Pass (18.7s) |
| Deploy to Vercel | ✅ `6b6b154` on `main` |
| Health endpoints | ✅ `/health`, `/health/live`, `/health/ready`, `/health/monitor` → 200 |

---

## Certification checklist

| Criterion | Target | Status | Evidence |
|-----------|--------|--------|----------|
| Sidebar navigation <300ms | Perceived | ⏳ **NOT VERIFIED** | Requires embedded Shopify Admin MV-1 |
| Dashboard shell <1s | TTFB | ⏳ **NOT VERIFIED** | Auth redirect only in logs |
| Inventory first render <1s | Workspace core | ⏳ **NOT VERIFIED** | Architecture in place; no auth session |
| Table first page immediate | Products 25 rows | ✅ **VERIFIED** | Code + pagination |
| AI never blocks page | Deferred shell | ✅ **VERIFIED** | Architecture + unit tests |
| Production `[route-loader]` timings | Before/after | ⏳ **PARTIAL** | Auth path 1ms (unauthenticated) |
| Lighthouse LCP/FCP/TBT | Embedded `/app` | ⏳ **PARTIAL** | Unauthenticated `/app` only |

---

## Before vs after

### Architectural (P1 → P2)

| Area | Before (P1) | After (P2) |
|------|-------------|------------|
| Workspace navigation | Shell + core parallel (~8 queries blocking) | **Core only; shell deferred** |
| Settings auth | Duplicate auth + store | **Single `resolveRequestStoreContext`** |
| Executive loader | 2× decisions query | **1× prefetched decisions** |
| Root Cause / Predictions | Duplicate list + map queries | **Single fetch + map helper** |
| KG stats | Live full scan | **Persisted cache (<5 min)** |
| Products | 50 rows fixed | **25 paginated (20–50 via URL)** |
| Inventory lists | take 10 | **take 20, no full-table fetch** |
| Loader logs | Section name only | **Category stack (`auth`/`database`/…)** |

### Route-by-route improvements

| Route | Key change |
|-------|------------|
| Executive | Deduped decisions; shell deferred |
| Inventory | Deferred shell; 20 rows/domain |
| Products | Paginated 25/page; column `select` |
| Collections | Deferred shell |
| Knowledge Graph | Cached graph statistics |
| Business Memory | Parallel 5-way + deferred shell |
| Root Cause | Deduped fetch + deferred shell |
| Predictions | Deduped fetch + deferred shell |
| Experiments | Parallel 2-way + deferred shell |
| Merchant Intelligence | Parallel 5-way + deferred shell |
| Billing | Timed sections + shared context |
| Settings | Shared context + parallel 5-way fetch |
| Dashboard | Intelligence deferred (P1); shell parallel (P1) |
| Orders | **No route** — metrics via dashboard cache |

### Lighthouse — unauthenticated `/app` redirect page

| Metric | P1 (`c192478`) | P2 (`6b6b154`) | Delta |
|--------|----------------|----------------|-------|
| Performance score | 0.88 | **0.92** | +0.04 |
| First Contentful Paint | 2840 ms | **2674 ms** | −166 ms |
| Largest Contentful Paint | 2873 ms | **2686 ms** | −187 ms |
| Total Blocking Time | 80 ms | **51 ms** | −29 ms |
| Time to Interactive | 3255 ms | **2825 ms** | −430 ms |
| TTFB | — | **6 ms** | — |

**Artifact:** `docs/performance/lighthouse-p2-app-unauth.json`

> Embedded `/app` (authenticated Shopify Admin iframe) Lighthouse **NOT CAPTURED** — requires OAuth session.

### Production `[route-loader]` logs (post-deploy)

Unauthenticated probes to `/app` and `/app/inventory` (302 → auth):

```
function: authenticateAndResolveStore
operation: loader_section_timing
reason: 1ms
stack: auth
```

Full `workspaceCore` / `dashboardShellParallel` timings require authenticated merchant navigation.

---

## Remaining bottlenecks

1. **`globalSearch` / `unifiedTimeline`** — still ~8 queries when deferred shell resolves (non-blocking but adds background load)
2. **Command center, operations, onboarding, automation** — still use raw `authenticate.admin` (not migrated)
3. **No dedicated Orders workspace route**
4. **Embedded Shopify Lighthouse + sidebar navigation timing** — requires MV-1 manual session
5. **`intelligence-workspace-views.tsx`** — 47 kB server chunk; candidate for per-workspace lazy split

---

## Recommended future optimizations

1. Short-TTL in-memory cache for `buildGlobalSearch` per `storeId`
2. Migrate remaining routes to `resolveRequestStoreContext`
3. Split `intelligence-workspace-views.tsx` into per-workspace lazy chunks
4. URL-driven pagination for inventory domain lists at scale
5. MV-1 capture: `dashboardShellParallel`, `workspaceCore`, `globalSearch` under real merchant load

---

## Sign-off

**NOT FULLY CERTIFIED** for merchant-perceived navigation speed.

**Verified:** P2 code deployed (`6b6b154`), engineering gates pass, health green, deferred-shell architecture live, unauthenticated Lighthouse improved, auth-path instrumentation confirmed.

**Pending:** Embedded MV-1 navigation test with authenticated `[route-loader]` timings for Dashboard, Inventory, Products, Billing, Settings.

---

## MV-1 capture commands

```bash
# After navigating routes in embedded Shopify Admin:
npx vercel logs store-pilot-eta.vercel.app --since 30m --expand | findstr loader_section_timing

# Filter workspace sections:
findstr "workspaceCore globalSearch unifiedTimeline dashboardShellParallel"
```
