# Performance Before / After — P1 Performance Sprint

**Date:** 2026-07-11

---

## Summary

| Area | Before | After |
|------|--------|-------|
| Store lookup per request | 1–2× (layout + child) | **1×** (WeakMap) |
| Dashboard metrics on cache miss | Blocking 7 queries | **Non-blocking** (zeros + background) |
| Workspace shell loading | Sequential before workspace data | **Parallel** |
| Workspace document SSR | Full loader blocked TTFB | **Shell + deferred `.data`** |
| Workspace JS bundle | Static import all views | **Lazy import** |
| COO loader | Sequential | **Parallel** |
| Billing loader | auth + findUnique | **Shared context** |

---

## Estimated timing impact (architectural)

| Flow | Before (est.) | After (est.) | Evidence |
|------|---------------|--------------|----------|
| Dashboard shell TTFB | 1.5–15s (pool/SQL issues) | **<1.5s** target | ⏳ NOT VERIFIED |
| Executive navigation | 800ms–2s | **300–800ms** | ⏳ NOT VERIFIED |
| Fresh install dashboard | SSR abort possible | Shell renders, AI deferred | P0 + P1 guards |
| Metrics first paint | Blocked on 7 counts | Instant (cache or zeros) | ✅ Unit tested |

---

## Engineering validation

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm test` | ✅ 3042/3042 |
| `npm run build` | ✅ |

---

## Production measurement plan

1. Deploy to Vercel
2. Capture `[route-loader]` timing logs for `loader_section_timing`
3. Run Lighthouse on embedded `/app`
4. Manual: sidebar click → time-to-interactive per workspace
5. Record in this document with timestamps

---

## Lighthouse

**Before baseline:** Not captured in this sprint.  
**After:** NOT VERIFIED — requires post-deploy run.
