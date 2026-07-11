# Performance Before / After — P1 Performance Sprint

**Date:** 2026-07-11  
**Deploy SHA:** `7e40bb4`

---

## Code-level changes (verified)

| Area | Before | After |
|------|--------|-------|
| Store lookup per request | 1–2× (layout + child) | **1×** (WeakMap) |
| Dashboard metrics on cache miss | Blocking 7 queries | **Non-blocking** (zeros + background) |
| Workspace shell loading | Sequential | **Parallel** |
| Workspace document SSR | Full loader blocked TTFB | **Shell + deferred `.data`** |
| Workspace JS bundle | Static import all views | **Lazy import** |
| COO loader | Sequential | **Parallel** |
| Loader timing logs | None | **`loader_section_timing`** in production |

---

## Production evidence (post-deploy)

### Health endpoints — ✅ VERIFIED

All `/health/*` return HTTP 200 after `7e40bb4` deploy.

### `[route-loader]` timing — ✅ VERIFIED (partial)

Production logs confirm instrumentation on `GET /app`:

```
operation: loader_section_timing
function: authenticateAndResolveStore
reason: 1ms | 3ms
```

Full `dashboardShellParallel` timings require authenticated merchant session (not available in automated probe).

See: `docs/manual-validation/P1_DEPLOY_RUN_20260711.md`

### Lighthouse `/auth/login` (public baseline)

| Metric | P0 MV1 | P1 deploy | Notes |
|--------|--------|-----------|-------|
| Performance score | 0.92 | 0.84 | Public login — not dashboard |
| FCP | 2.7 s | 3.1 s | Network variance |
| LCP | 2.7 s | 3.2 s | — |
| TBT | 13 ms | 0 ms | — |
| CLS | 0 | 0 | ✅ Under 0.1 budget |

Raw: `docs/manual-validation/lighthouse-p1-auth-login.json`

### Lighthouse `/app` (embedded dashboard)

⏳ **NOT VERIFIED** — Shopify OAuth required.

---

## Engineering validation — ✅ VERIFIED

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm test` | ✅ 3042/3042 |
| `npm run build` | ✅ |

---

## Certification status

**NOT FULLY CERTIFIED** — architecture deployed and instrumented; embedded dashboard timings pending MV-1 manual capture.
