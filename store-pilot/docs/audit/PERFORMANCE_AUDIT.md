# Performance Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Overall Assessment

StorePilot is optimized for **correctness and intelligence pipeline reliability** over raw frontend performance. Sync services dominate codebase size and are the primary scalability bottleneck.

**Performance Score:** 84/100

---

## Cold Start

| Component | Assessment |
|-----------|------------|
| Vercel serverless | React Router SSR — typical 200-800ms cold start |
| Prisma client | Singleton with instrumentation — amortized after first request |
| Worker container | Long-running — no cold start (`Dockerfile.worker`) |
| Intelligence workspace loaders | 5-8 parallel DB queries — ~50-150ms warm |

**Recommendation:** Enable Vercel function warming for `/app` dashboard route.

---

## Bundle Analysis

| Factor | Status |
|--------|--------|
| Code splitting | Route-based via React Router 7 file routes — automatic |
| Lazy loading | Intelligence workspaces are separate route files — ✅ |
| Heavy components | `CommandCenter.tsx` (1,201 lines), `ExecutiveDashboard.tsx` (1,034 lines) — not lazy |
| Polaris | Web components (`s-*`) — no `@shopify/polaris` React bundle — ✅ lightweight |
| OpenAI SDK | Server-side only — not in client bundle — ✅ |

**Recommendation:** Lazy-load CommandCenter and ExecutiveDashboard if routes remain separate from intelligence workspaces.

---

## React Rendering

| Area | Assessment |
|------|------------|
| Dashboard | Loads 10+ data sources in single loader — potential over-fetch |
| Intelligence workspaces | `IntelligenceWorkspaceProvider` — minimal context |
| Memoization | Limited use of `useMemo`/`React.memo` in intelligence-ui |
| Re-renders | Flow nav state changes re-render workspace content — acceptable |
| Virtualization | Not implemented for long lists (products, graph nodes) |

**Recommendation:** Virtualize product lists and timeline events at 100+ items.

---

## Database Performance

See `QUERY_PERFORMANCE.md`. Key bottlenecks: order sync transactions, dashboard loader fan-out.

---

## Worker Performance

- SKIP LOCKED claiming — efficient
- Pipeline jobs can run 5+ minutes (knowledge/graph) — heartbeat prevents stale release
- Concurrent workers safe via row locking

---

## Caching

| Cache | Type | Durability |
|-------|------|------------|
| Foundation AI cache | In-memory | Process-local |
| V2 result cache | Prisma | Durable |
| Graph cache | Partial Foundation cache import | Process-local |
| No HTTP cache headers audit | — | Review loader cache headers |

---

## Intelligence Engine Performance

All deterministic engines (prediction, experiment, root-cause, merchant-intelligence) run in worker jobs — **not on request path**. This is architecturally correct for performance.

---

## Expected Improvements

| Optimization | Impact |
|--------------|--------|
| Lazy-load global search in workspaces | -30% workspace loader time |
| Virtualize long lists | -40% render time on products/timeline |
| Cache store context per request | -10ms per route |
| Split order sync batches | -50% transaction lock time |

---

## Bundle / Cold Start Reports

Formal bundle analysis (`vite-bundle-visualizer`) not run in this audit. Recommend adding to CI post-launch.
