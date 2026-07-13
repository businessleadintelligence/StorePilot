# P2 Final Performance Certification

**Date:** 2026-07-13  
**Deploy SHA (code):** pending P2.1 push  
**Prior deploy:** `6b6b154` / cert docs `4ec3639`  
**Production:** https://store-pilot-eta.vercel.app  
**Sprint:** P2 Route-Level Performance Optimization

---

## Authenticated field evidence (Executive)

**Source:** Chrome UX / PageSpeed field data on embedded Shopify Admin  
**URL:** [admin.shopify.com … /app/executive](https://admin.shopify.com/store/soham-7vlh5dqi/apps/storepilot-132/app/executive)  
**Core Web Vitals Assessment:** **Failed**

| Metric | Field value | P2 target | Status |
|--------|-------------|-----------|--------|
| LCP | **9.9 s** | Dashboard/Inventory shell &lt;1 s | ❌ Fail |
| FCP | **7.3 s** | First paint immediate | ❌ Fail |
| TTFB | **1.4 s** | Auth+shell fast | ❌ Fail (auth/proxy heavy) |
| INP | **669 ms** | Sidebar &lt;300 ms perceived | ❌ Fail |
| CLS | **0.13** | Stable layout | ⚠️ Borderline |

### Root cause (confirmed in code)

P2 document SSR returned an **empty shell** (`deferWorkspaceLoad: true`), then the client called **`revalidate()`** for a second `.data` round-trip before any workspace content painted.

Reconstructed timeline for Executive:

1. **TTFB ~1.4 s** — Shopify Admin iframe + `authenticateAdminOnce` (layout) + route auth  
2. **FCP ~7.3 s** — hydration + second fetch + lazy `intelligence-workspace-views` chunk  
3. **LCP ~9.9 s** — `workspaceCore` (executive + queue + stability + merchant + memory) finally paints cards  
4. **INP ~669 ms** — main-thread cost of Polaris web components + revalidation + lazy import  
5. **CLS 0.13** — skeleton → full workspace swap  

Unauthenticated Lighthouse on `/app` redirect (**0.92 / LCP 2.7 s**) was **not representative** of embedded merchant routes.

---

## P2.1 fix (implemented, pending deploy)

1. **Stream workspace on document SSR** — return deferred `workspace` Promise; Phase 1 paints title + skeleton; `Await` resolves Phase 2 **without** client revalidate  
2. **Phase 1 titles** on all workspace routes (e.g. “Executive Intelligence”)  
3. **Executive parallelization** — decisions no longer block the rest of the `Promise.all` waterfall  
4. Feature-gated routes use the same streaming path after billing check  

---

## Engineering gate (pre-P2.1)

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ (P2.1 local) |
| Workspace loader tests | ✅ 2/2 |
| Full suite / lint / build | ⏳ run before push |
| Deploy | ⏳ pending |

---

## Certification checklist

| Criterion | Target | Status |
|-----------|--------|--------|
| Sidebar navigation &lt;300 ms | Perceived | ❌ **Failed** (INP 669 ms field) |
| Dashboard / Executive shell &lt;1 s | First content | ❌ **Failed** (LCP 9.9 s / FCP 7.3 s) |
| Inventory first render &lt;1 s | Workspace core | ⏳ Retest after P2.1 |
| Table first page immediate | Products 25 rows | ✅ Code |
| AI never blocks page | Deferred shell | ✅ Architecture (search/timeline) |
| Authenticated CWV | Embedded `/app/*` | ✅ **Captured** — failed targets |
| Production improvement | Before → after | ⏳ Retest Executive after P2.1 deploy |

---

## Before vs after (architectural)

| Area | P2 (`6b6b154`) | P2.1 (this fix) |
|------|----------------|-----------------|
| Document SSR | Empty shell + client `revalidate()` | **Streamed workspace Promise + Await** |
| First paint | “Loading workspace” after 2nd trip | **Route title immediately** |
| Executive loader | `await decisions` then `Promise.all` | **Fully parallel** (decisions shared) |
| Field LCP | **9.9 s** | Pending remeasure |

---

## Remaining bottlenecks (after P2.1)

1. **TTFB 1.4 s** — Shopify Admin proxy + dual auth (layout + route); needs cache / session warm path  
2. **Executive `workspaceCore` still heavy** — merchant intelligence + historical memory still on critical path (parallel, not deferred to Phase 4)  
3. **Lazy 47 kB views chunk** — still on LCP critical path after stream resolves  
4. **INP** — Polaris custom elements + large React tree; needs interaction profiling  
5. **globalSearch / unifiedTimeline** — background queries still fire after core  

---

## Recommended next optimizations (P3)

1. Defer merchant intelligence + historical memory out of Executive Phase 2  
2. Preload / split `intelligence-workspace-views` per workspace kind  
3. Layout-level session reuse to cut TTFB  
4. Reduce CLS: reserve height for summary metric grid  
5. Re-run field CWV / Lighthouse on Executive after deploy  

---

## Sign-off

**NOT CERTIFIED.** Authenticated Executive field metrics fail P2 targets.

P2 code reduced query waste and deferred aside/shell, but the empty-shell + revalidate pattern **regressed LCP/FCP**. P2.1 addresses that architectural defect; certification waits on post-deploy remeasure of the same Executive URL.
