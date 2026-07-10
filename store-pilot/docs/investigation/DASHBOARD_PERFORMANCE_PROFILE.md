# Dashboard Performance Profile — P0 Stabilization

**Route:** `app/routes/app._index.tsx`  
**Instrumentation:** `[route-loader]` logs + Vercel `[db-slow-query]`

---

## Loader phases

| Phase | Function | Document SSR (`GET /app`) | Data request (`GET /app.data`) | Blocking? |
|-------|----------|---------------------------|----------------------------------|-----------|
| Auth | `authenticateAdminOnce` | ✅ | ✅ | Yes |
| Store lookup | `prisma.store.findUnique` | ✅ | ✅ | Yes |
| Shell | `getOnboardingStatus` | ✅ | ✅ | Yes (parallel) |
| Shell | `getStoreSyncStatus` | ✅ | ✅ | Yes (parallel) |
| Shell | `getStoreMetrics` | ✅ | ✅ | Yes (parallel) — cache miss may run 7 counts |
| Sync compute | health/brief/insights/recommendations | ✅ | ✅ | Yes (sync CPU) |
| Intelligence | 7 UI loaders | **❌ Skipped** | ✅ Promises | Data only |
| Client revalidation | `useEffect` → `.data` | After hydration | N/A | Non-blocking |

---

## Intelligence sections (deferred)

| Section | Service | Empty store behavior |
|---------|---------|---------------------|
| Learning bootstrap | `getLearningBootstrapForUi` | `findMany` → `[]` → null UI |
| Quick wins | `getQuickWinsForDashboard` | Empty → null |
| Executive | `getExecutiveDashboardForUi` | Empty dashboards |
| Root cause | `getRootCauseDashboardForUi` | `[]` |
| Predictions | `getPredictionDashboardForUi` | `[]` |
| Experiments | `getExperimentDashboardForUi` | `[]` |
| Merchant intelligence | `getMerchantIntelligenceDashboardForUi` | Empty |

**Post-fix:** Each wrapped in `deferIntelligenceSection()` → rejects resolve to **`null`**, logged with stack trace.

---

## Issues identified

| Issue | Severity | Status |
|-------|----------|--------|
| 7 parallel intelligence queries on document SSR | P0 | ✅ Fixed — SSR guard |
| Revalidation loop (`/app.data` storm) | P0 | ✅ Fixed — useRef + stable deps |
| Duplicate `authenticateAdminOnce` parent+child | P2 | Mitigated via WeakMap cache |
| `getStoreMetrics` cache miss = 7 parallel counts | P1 | Documented — returns zeros acceptable on first paint |

---

## Sequential vs parallel

| Block | Execution |
|-------|-----------|
| `Promise.all([onboarding, sync, metrics])` | Parallel (3 queries) — acceptable for shell |
| Intelligence (data request) | 7 promises start together — **pool risk** mitigated by not running on document SSR |
| Parent `app.tsx` loader | Runs before child — auth cached |

---

## Recommendations

1. ✅ Keep document SSR shell-only (implemented)
2. Consider serializing intelligence sections on `.data` if pool waits persist
3. Metrics cache miss: return `EMPTY_METRICS` synchronously, background recompute (future)

---

## Before / after first paint

| | Before | After |
|--|--------|-------|
| Queries on first `GET /app` | 15–25+ | ~5–8 (shell only) |
| Merchant sees error | Yes (SSR abort) | Expected: dashboard shell |
| Intelligence cards | N/A (crashed) | Load after hydration via `.data` |

**Production timing verification:** **NOT VERIFIED** — requires Lighthouse + Vercel logs on fresh install.
