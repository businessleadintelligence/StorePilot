# Route Load Profile — P2 Performance Sprint

**Date:** 2026-07-11  
**Scope:** Merchant workspace routes + Billing + Settings

---

## Summary

| Route | Loader | Auth context | Shell loading | Workspace DB | AI in loader |
|-------|--------|--------------|---------------|--------------|--------------|
| Executive | `getExecutiveWorkspaceData` | ✅ Shared | **Deferred** | Parallel, deduped decisions | None |
| Inventory | `getDomainWorkspaceData` | ✅ Shared | **Deferred** | 20 rows/domain type | None |
| Products | `getProductsWorkspaceData` | ✅ Shared | **Deferred** | Paginated 25/page | None |
| Collections | `getCollectionsWorkspaceData` | ✅ Shared | **Deferred** | take 30 | None |
| Orders | — | **No route** | — | — | — |
| Knowledge Graph | `getKnowledgeGraphWorkspaceData` | ✅ Shared | **Deferred** | Cached stats + 50 nodes | None |
| Business Memory | `getBusinessMemoryWorkspaceData` | ✅ Shared | **Deferred** | Parallel 5-way | None |
| Root Cause | `getRootCausesWorkspaceData` | ✅ Shared | **Deferred** | Deduped root cause fetch | None |
| Predictions | `getPredictionsWorkspaceData` | ✅ Shared | **Deferred** | Deduped prediction fetch | None |
| Experiments | `getExperimentsWorkspaceData` | ✅ Shared | **Deferred** | Parallel 2-way | None |
| Merchant Intelligence | `getMerchantIntelligenceWorkspaceData` | ✅ Shared | **Deferred** | Parallel 5-way | None |
| Billing | inline | ✅ Shared | N/A | Cached dashboard | None |
| Settings | inline | ✅ Shared (P2) | N/A | Parallel 5-way | None |
| Dashboard | `app._index` | ✅ Shared | Intelligence deferred | Parallel shell | None |

---

## P2 improvements per route

### Executive
- **Before:** `loadWorkspaceShell` blocked workspace; duplicate `getExecutiveDecisions`
- **After:** Shell deferred; decisions fetched once and passed to `getExecutiveDashboardForUi`
- **Query limits:** decisions take 50, queue take 30

### Inventory
- **Before:** Shell + domain data parallel; take 10 per entity
- **After:** Shell deferred; domain lists take **20**; first render shows workspace without global search/timeline wait
- **Note:** Inventory page shows intelligence cards, not product table rows

### Products
- **Before:** take 50, no pagination
- **After:** **25 per page** (20–50 via `?pageSize=`), `select` only needed columns, total count parallel

### Knowledge Graph
- **Before:** Live `computeGraphStatistics` (unbounded edge scan)
- **After:** **`getGraphStatisticsForLoader`** reads persisted stats when fresh (<5 min)

### Settings
- **Before:** Duplicate `authenticate.admin` + `store.findUnique`
- **After:** `resolveRequestStoreContext` + timed parallel fetch

---

## Instrumentation

All workspace `.data` loads emit:

```
operation: loader_section_timing
function: authenticateAndResolveStore | workspaceCore | globalSearch | unifiedTimeline | featureGate
stack: auth | database | billing | cache
```

See `ROUTE_TIMINGS.md`.

---

## Remaining bottlenecks

1. Embedded `/app` Lighthouse — requires Shopify OAuth session
2. `buildGlobalSearch` still 5 queries when shell resolves (deferred, non-blocking)
3. Command center / operations routes not migrated to shared context (out of P2 scope)

---

## Orders route

**Does not exist.** Order metrics available on dashboard via `StoreMetricsCache`.
