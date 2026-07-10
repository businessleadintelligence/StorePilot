# Query Performance Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Slow Query Report (Static Analysis)

No production APM traces available. Findings based on code patterns and schema design.

| Hot Path | File | Pattern | Risk |
|----------|------|---------|------|
| Order sync upsert | `orders.server.ts` | Large `$transaction` batches | Lock contention, long transactions |
| Product sync | `product.server.ts` | Paginated Shopify + batch upsert | API rate limits + DB write volume |
| Worker claim | `job.server.ts:529` | Raw SQL `FOR UPDATE SKIP LOCKED` | Optimized — low risk |
| Dashboard loader | `app._index.tsx` loader | 10+ sequential/parallel service calls | TTFB on cold start |
| Intelligence workspace | `intelligence-workspace.server.ts` | `Promise.all` with 5-8 queries per workspace | Acceptable with indexes |
| Graph node listing | `buildGraphNodes()` | `findMany` take 30-50, no pagination | OK at current limits |
| Global search | `buildGlobalSearch()` | 5 parallel findMany + graph search | Bounded by take limits |

---

## N+1 Query Risks

| Location | Pattern | Severity |
|----------|---------|----------|
| `prediction-api.ts` | `findMany` with `include: { preventionActions }` | Low — single query with join |
| `experiment-api.ts` | `include: { experiment: true }` on recommendations | Low |
| `executive-api.ts` | `getOperationsQueue` includes `decision: true` | Low |
| `orders.server.ts` line item processing | Potential per-order loops in sync | **High** — review inner loops |
| `intelligence-workspace-views.tsx` | No DB calls — render only | None |

**Recommendation:** Profile `orders.server.ts` sync with `PRISMA_LOG_QUERIES=1` on staging store with 10K+ orders.

---

## Repeated Queries

| Query | Occurrences | Optimization |
|-------|-------------|--------------|
| `store.findUnique({ shopifyDomain })` | Every authenticated route | Cache in request context after auth |
| `getBusinessStability(storeId)` | Dashboard + executive + predictions workspace | Redis/request cache (5 min TTL) |
| `buildGlobalSearch(storeId)` | Every intelligence workspace load | Defer to CommandBar lazy load |
| `buildUnifiedTimeline(storeId)` | Every workspace | Shared cache per request |

---

## Pagination Gaps

| Endpoint/Loader | Pagination | Risk |
|-----------------|------------|------|
| Products workspace | `take: 50` hard cap | OK for v1 |
| Knowledge graph viewer | `take: 50` | Needs virtual scroll (UI has list) |
| Orders sync | Cursor-based Shopify pagination | Implemented |
| Job event history | No UI exposure | N/A |

---

## Optimization Opportunities

| Fix | Expected Benefit | Effort |
|-----|------------------|--------|
| Cache store lookup per request | -1 DB round trip per route (~5-15ms) | 1 day |
| Lazy-load global search in workspaces | -5 queries on workspace load | 1 day |
| Split orders.server.ts transaction batches | Reduced lock time, fewer timeouts | 3-5 days |
| Add composite indexes (see DATABASE_AUDIT) | 20-50% on filtered domain queries | 1-2 days |
| Request-level memoization for dashboard loader | Faster dashboard TTFB | 2 days |
| Prefetch workspace data on dashboard card hover | Perceived latency improvement | 2-3 days |

---

## Memory Usage

| Area | Concern |
|------|---------|
| `vitest.setup.ts` (3,724 lines) | Test memory only |
| Graph product subgraph | Loaded whole into memory — OK for single product |
| In-memory AI caches | Foundation cache + V2 cache — bounded by TTL |
| Worker job payload JSON | Unbounded if webhook payloads stored — verify job payload size limits |

---

## Worker Query Patterns

- Claim query uses index-optimized raw SQL — **good**
- Stale release scans `lockExpiresAt` index — **good**
- Orphan detection queries worker registry — gap: offline worker recovery incomplete (see WORKER_AUDIT)
- Checkpoint stores use DB persistence — **good** for long-running knowledge/graph jobs
