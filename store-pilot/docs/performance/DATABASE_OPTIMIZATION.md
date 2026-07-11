# Database Optimization — P1 Performance Sprint

---

## Changes

### 1. StoreMetricsCache — non-blocking dashboard reads

**Problem:** Cache miss triggered 7 parallel COUNT/aggregate queries on every first dashboard paint.

**Fix:** `getStoreMetrics(id, { nonBlocking: true })` on dashboard shell.

| Scenario | Behavior |
|----------|----------|
| Fresh cache | Return immediately |
| Stale cache | Return stale + background recompute |
| Miss (dashboard) | Return zeros + background recompute |
| Miss (other callers) | Blocking recompute (unchanged) |

### 2. Eliminated duplicate store lookups

`resolveRequestStoreContext` WeakMap — one `Store.findUnique` per HTTP request across parent + child loaders.

### 3. Parallel workspace queries

`loadWorkspaceShell` no longer blocks workspace-specific queries — runs concurrently.

---

## Remaining opportunities

| Query pattern | Location | Action |
|---------------|----------|--------|
| `buildGlobalSearch` — 5 queries | Every workspace | Short-TTL cache or defer |
| Settings 5-way parallel | `app.settings.tsx` | OK — already parallel |
| Executive dashboard live metrics | `executive-dashboard.server.ts` | Uses cache via `getStoreMetrics` |

---

## Background refresh (existing)

- Cron `metrics_recompute` jobs
- Stale-while-revalidate on cache read

---

## Index coverage

P0 migration `20260710160000_p0_query_performance_indexes` — unchanged, still valid.
