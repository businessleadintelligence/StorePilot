# Component Audit — P1 Performance Sprint

---

## Dashboard (`app._index.tsx`)

| Component | Pattern | Status |
|-----------|---------|--------|
| `LearningBootstrapCard` | `React.lazy()` | ✅ Already split |
| `QuickWinsCard` | `React.lazy()` | ✅ |
| `ExecutiveDashboardCards` | `React.lazy()` | ✅ |
| `RootCauseDashboardCards` | `React.lazy()` | ✅ |
| `PredictionDashboardCards` | `React.lazy()` | ✅ |
| `ExperimentDashboardCards` | `React.lazy()` | ✅ |
| `MerchantIntelligenceDashboard` | `React.lazy()` | ✅ |
| Intelligence sections | `<Suspense>` + `<Await>` | ✅ |
| Revalidation storm | `useRef` guard | ✅ (P0 fix) |

**Shell components** (Hero, Health, Metrics, Sync) render synchronously — intentional for LCP.

---

## Workspace routes (new)

| Component | Change |
|-----------|--------|
| `IntelligenceWorkspaceRoute` | Central defer + lazy view wrapper |
| `intelligence-workspace-views.tsx` | **Lazy-loaded** per navigation (code split) |
| Skeleton fallback | `DeferredSectionSkeleton` |

**Before:** 14 routes statically imported 723-line workspace views module.  
**After:** Dynamic import on first workspace visit.

---

## Re-render risks (unchanged — monitor)

| Component | Risk | Mitigation |
|-----------|------|------------|
| `WorkspaceLayout` | Large prop trees | Future: memo on section cards |
| `useRevalidator` | Effect deps | Stable destructured deps |

---

## Recommendations

1. Split `intelligence-workspace-views.tsx` into per-workspace view modules (smaller lazy chunks)
2. Memoize `MetricsOverviewCard` if parent revalidations increase
3. Avoid passing full loader data to deep children — pass slices
