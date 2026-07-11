# P1 Performance Deploy Run — 2026-07-11

**Deployment SHA:** `7e40bb4`  
**Production URL:** https://store-pilot-eta.vercel.app  
**Vercel deployment:** `store-pilot-hkt2gkn26-businessleadintelligences-projects.vercel.app`  
**Time (IST):** 2026-07-11 ~10:32

---

## Deploy verification

| Step | Result | Evidence |
|------|--------|----------|
| Git push `main` | ✅ PASS | `7e40bb4` |
| Vercel production deploy | ✅ Ready | 3m build |
| `/health` | ✅ 200 | Spot check |
| `/health/ready` | ✅ 200 | Spot check |
| `/health/worker` | ✅ 200 | Spot check |
| `/health/monitor` | ✅ 200 | Spot check |
| Engineering gate (pre-push) | ✅ PASS | 3042/3042 tests, lint, typecheck, build |

---

## `[route-loader]` logs — `loader_section_timing`

**Command:**
```bash
npx vercel logs store-pilot-eta.vercel.app --since 30m --expand
```

**Captured (unauthenticated `GET /app` probes):**

| Request ID | Function | Duration | Notes |
|------------|----------|----------|-------|
| `bom1::22zmx-...` | `authenticateAndResolveStore` | **1ms** | Auth redirect — no shop session |
| `bom1::ssfnk-...` | `authenticateAndResolveStore` | **3ms** | Auth redirect — no shop session |

**Not captured:** `dashboardShellParallel` timings — requires authenticated Shopify embedded session. Unauthenticated requests fail at auth with `[object Response]` before shell DB work runs.

**Instrumentation status:** ✅ **VERIFIED** — `loader_section_timing` logs appear in production.

---

## Lighthouse

### `/auth/login` (public — proxy baseline, not embedded dashboard)

| Metric | P0 MV1 (`fc584ba`) | P1 (`7e40bb4`) | Delta |
|--------|-------------------|----------------|-------|
| Performance score | **0.92** | **0.84** | −0.08 (network variance) |
| FCP | 2.7 s | 3.1 s | +0.4 s |
| LCP | 2.7 s | 3.2 s | +0.5 s |
| TBT | 13 ms | **0 ms** | improved |
| CLS | 0 | **0** | unchanged |
| INP (max potential FID) | 76 ms | **16 ms** | improved |

Raw report: `docs/manual-validation/lighthouse-p1-auth-login.json`

### `/app` (embedded dashboard)

| Status | Reason |
|--------|--------|
| ⏳ **NOT VERIFIED** | Requires Shopify OAuth + embedded Admin session. Headless Lighthouse on `/app` without session cannot measure dashboard shell LCP. |

**Manual capture required:** Chrome DevTools → Lighthouse inside Shopify Admin after install.

---

## Certification gaps remaining

| Criterion | Status |
|-----------|--------|
| Dashboard shell <2s | ⏳ NOT VERIFIED — needs authenticated session |
| Navigation <300ms | ⏳ NOT VERIFIED — needs merchant navigation test |
| `/app` Lighthouse LCP <2.5s | ⏳ NOT VERIFIED — embedded only |
| Loader timing instrumentation | ✅ VERIFIED |
| Health endpoints green | ✅ VERIFIED |

---

## Recommended next manual step

1. Fresh dev store install (MV-1)
2. Open embedded `/app` in Shopify Admin
3. Run Vercel log query: `loader_section_timing` + `dashboard_document_shell`
4. Chrome Lighthouse on embedded dashboard tab
5. Update `FINAL_PERFORMANCE_CERTIFICATION.md`
