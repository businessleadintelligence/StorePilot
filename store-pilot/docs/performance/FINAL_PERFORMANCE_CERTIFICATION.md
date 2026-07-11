# Final Performance Certification — P1 Sprint

**Date:** 2026-07-11  
**Deploy SHA:** `7e40bb4`  
**Production:** https://store-pilot-eta.vercel.app

---

## Implemented optimizations (deployed)

1. **`resolveRequestStoreContext`** — one auth + store lookup per HTTP request
2. **Non-blocking dashboard metrics** — `StoreMetricsCache` with `{ nonBlocking: true }`
3. **Dashboard shell architecture** — critical path only on document SSR; AI deferred
4. **Workspace defer pattern** — document shell → client `.data` revalidation
5. **Parallel workspace loaders** — shell + data concurrently
6. **Lazy workspace views** — code-split intelligence UI
7. **COO parallel loader** — reminders + dashboard concurrently
8. **Loader timing instrumentation** — `timeLoaderSection()` → `[route-loader]` production logs

---

## Certification checklist

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Dashboard shell <2s (typical store) | ⏳ **NOT VERIFIED** | Needs embedded MV-1 session |
| Navigation <300ms perceived | ⏳ **NOT VERIFIED** | Needs merchant navigation test |
| AI workspaces don't block initial render | ✅ **VERIFIED** | Architecture + unit tests |
| Repeated DB lookups consolidated | ✅ **VERIFIED** | `resolveRequestStoreContext` + tests |
| Materialized metrics on dashboard shell | ✅ **VERIFIED** | `nonBlocking` + unit test |
| Lighthouse improvement | ⏳ **PARTIAL** | Public `/auth/login` captured; `/app` requires OAuth |
| typecheck / lint / test / build | ✅ **VERIFIED** | 3042/3042 pre-push |
| Before/after production timings | ⏳ **PARTIAL** | See deploy run doc |
| Health endpoints green post-deploy | ✅ **VERIFIED** | All 200 |
| `loader_section_timing` in production | ✅ **VERIFIED** | Vercel logs 1–3ms auth path |

---

## Production evidence summary

### Vercel `[route-loader]` logs

```
function: authenticateAndResolveStore
operation: loader_section_timing
reason: 1ms | 3ms
```

Full dashboard shell timings pending authenticated traffic.

**Deploy run:** `docs/manual-validation/P1_DEPLOY_RUN_20260711.md`

### Lighthouse

| Page | Performance | LCP | CLS | TBT |
|------|-------------|-----|-----|-----|
| `/auth/login` (P1) | 0.84 | 3.2 s | 0 | 0 ms |
| `/auth/login` (P0 MV1) | 0.92 | 2.7 s | 0 | 13 ms |
| `/app` embedded | — | — | — | NOT VERIFIED |

---

## Sign-off

**NOT FULLY CERTIFIED** for merchant-perceived performance.

**Verified:** Code deployed, health green, instrumentation live, engineering gates pass.  
**Pending:** Embedded `/app` Lighthouse + `dashboardShellParallel` log capture during MV-1 fresh install.

---

## Next step

Run MV-1 on a dev store and capture:
1. `npx vercel logs store-pilot-eta.vercel.app --since 30m --expand | findstr loader_section_timing`
2. Chrome Lighthouse inside Shopify Admin on `/app`
