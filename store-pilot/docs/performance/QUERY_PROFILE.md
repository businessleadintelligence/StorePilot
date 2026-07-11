# Query Profile — P1 Performance Sprint

---

## Problem pattern (before)

Every route independently executed:

```
authenticate.admin()
  → Store.findUnique({ shopifyDomain })
  → workspace-specific queries
```

Nested layouts (`app.tsx` + child) could trigger **2× auth + 2× store lookup** per navigation.

---

## Fixes implemented

### 1. Request-scoped store context

**File:** `app/lib/request-auth.server.ts`

```typescript
resolveRequestStoreContext(request)  // WeakMap — once per Request
```

**Consumers updated:**
- `app._index.tsx` (dashboard)
- `app.coo.tsx`
- `app.billing.tsx`
- `intelligence-workspace.server.ts` → `resolveStoreContext`

### 2. Non-blocking metrics on dashboard shell

**File:** `app/services/metrics.server.ts`

```typescript
getStoreMetrics(storeId, { nonBlocking: true })
```

Cache miss: returns `EMPTY_METRICS` immediately, background `recomputeStoreMetricsCache`.

Blocking path preserved for executive dashboard and other callers.

### 3. Parallel workspace loader fan-out

**File:** `app/services/intelligence-workspace.server.ts`

All `get*WorkspaceData` functions now run `loadWorkspaceShell` **in parallel** with workspace queries (not sequential).

**Estimated query reduction per executive navigation:** ~200–400ms wall-clock (sequential shell wait eliminated).

---

## Query counts by route (estimated)

| Route | Store lookups | Notes |
|-------|---------------|-------|
| Dashboard shell | **1** (shared context) | Was 1 + potential parent dup |
| Executive workspace | **1** | Was 1; shell+6 now parallel |
| Billing | **1** | Was auth + findUnique |
| Settings | 1–2 | Not yet migrated |

---

## N+1 / duplicate patterns remaining

| Pattern | Location | Priority |
|---------|----------|----------|
| Settings loader auth+store | `app.settings.tsx` | P2 |
| Command center auth+store | `app.command-center.tsx` | P2 |
| `getStoreMetrics` in executive-dashboard | Uses cache; OK | — |
| Intelligence `.data` 7 parallel sections | Dashboard | P2 batch under pool=1 |

---

## Instrumentation

`timeLoaderSection()` logs each loader segment duration to `[route-loader]` for production profiling.
