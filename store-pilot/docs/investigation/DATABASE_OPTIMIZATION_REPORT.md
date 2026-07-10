# Database Optimization Report — P0 Stabilization

**Scope:** Verified optimizations only — no business logic changes

---

## Already implemented (prior sprints — RESOLVED)

| Optimization | Location | Status |
|--------------|----------|--------|
| Job queue 7× count → 1× GROUP BY | `job.server.ts` | ✅ RESOLVED |
| Onboarding reconcile batch `take: 50` | `onboarding.server.ts` | ✅ RESOLVED |
| Prediction/root-cause `take: 20` | API files | ✅ RESOLVED |
| Store metrics cache table | `StoreMetricsCache` + cron recompute | ✅ RESOLVED |
| P0 indexes migration | `20260710160000_p0_query_performance_indexes` | ✅ RESOLVED |

---

## This sprint

| Change | File | Purpose |
|--------|------|---------|
| Fix subscription lock SQL | `billing-enforcement.server.ts` | Eliminate failed tx / retries |
| Sequential health monitors | `production-engine.ts` | Reduce parallel pool use |
| Cached health badge for reminders | `onboarding-recommendations.ts` | Avoid full health engine on COO |
| Dashboard SSR guard | `app._index.tsx` | Eliminate 7 intelligence query fan-out on first paint |
| Deferred intelligence `.catch → null` | `route-loader-log.server.ts` | Prevent rejection crash |

---

## Remaining opportunities (NOT implemented)

| Pattern | Location | Recommendation |
|---------|----------|----------------|
| Repeated `Store.findUnique` per request | Multiple loaders | Acceptable with `authenticateAdminOnce` cache |
| `getStoreMetrics` cache miss blocking | `metrics.server.ts` | Background recompute on miss |
| Webhook inline upsert | `product.server.ts` | Move to queued job |
| COO `getExecutiveDashboard` weight | `app.coo.tsx` | try/catch empty state (implemented) |

---

## COUNT / findMany audit summary

No additional duplicate COUNT loops identified beyond those already fixed in fc584ba/c12318d.

---

## Verification

All 3039 tests pass after changes.
