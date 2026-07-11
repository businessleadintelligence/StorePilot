# Route Timings — P2 Performance Sprint

---

## Instrumentation

**File:** `app/lib/route-loader-log.server.ts`

| Field | Meaning |
|-------|---------|
| `operation` | `loader_section_timing` |
| `function` | Section name |
| `reason` | Duration e.g. `42ms` |
| `stack` | Category: `auth`, `database`, `billing`, `cache` |

---

## Sections logged

| Section | Category | Routes |
|---------|----------|--------|
| `authenticateAndResolveStore` | auth | Dashboard, all workspaces, Billing, Settings |
| `dashboardShellParallel` | database | Dashboard |
| `workspaceCore` | database | All intelligence workspaces |
| `globalSearch` | database | Workspaces (deferred) |
| `unifiedTimeline` | database | Workspaces (deferred) |
| `featureGate` | billing | Predictions, Experiments, Merchant Intelligence |
| `settingsParallelFetch` | database | Settings |
| `billingDashboard` | database | Billing |

---

## Vercel query (production)

```bash
npx vercel logs store-pilot-eta.vercel.app --since 30m --expand | findstr loader_section_timing
```

Filter by category:

```bash
findstr "workspaceCore globalSearch unifiedTimeline"
```

---

## Expected timing profile (architectural)

| Phase | Target | P2 mechanism |
|-------|--------|--------------|
| Auth + store | <50ms | WeakMap `resolveRequestStoreContext` |
| Workspace core | <500ms | No shell in critical path |
| Shell (deferred) | Background | `globalSearch` + `unifiedTimeline` promises |
| Feature gate | <100ms | Single billing lookup before workspace |

---

## Production capture (post-deploy `6b6b154`)

| Probe | Result |
|-------|--------|
| Unauthenticated `GET /app` | `authenticateAndResolveStore` **1ms** (auth redirect) |
| Unauthenticated `GET /app/inventory` | Auth redirect; no `workspaceCore` logged |
| Health endpoints | All 200 |

⏳ **Authenticated timings NOT VERIFIED** — requires embedded Shopify Admin MV-1 session.

### Unauthenticated Lighthouse `/app` (redirect page)

| Metric | P1 | P2 |
|--------|----|----|
| Score | 0.88 | 0.92 |
| FCP | 2840 ms | 2674 ms |
| LCP | 2873 ms | 2686 ms |
| TBT | 80 ms | 51 ms |
| TTI | 3255 ms | 2825 ms |

Prior P1 unauthenticated probes: `authenticateAndResolveStore` **1–3ms** (auth redirect only).

---

## Before vs after (loader architecture)

| Metric | P1 | P2 |
|--------|----|----|
| Workspace shell in critical path | Yes (parallel) | **No (deferred)** |
| Settings duplicate store lookup | Yes | **No** |
| Executive duplicate decisions query | Yes | **No** |
| KG live full-graph scan | Yes | **Cached when fresh** |
| Products initial rows | 50 | **25 paginated** |
