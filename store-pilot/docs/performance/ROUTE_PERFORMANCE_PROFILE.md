# Route Performance Profile — P1 Performance Sprint

**Date:** 2026-07-11  
**Scope:** Merchant-facing app routes

---

## Methodology

Loaders instrumented via `timeLoaderSection()` in `route-loader-log.server.ts`. Timings emit as `[route-loader]` structured logs with `operation: loader_section_timing`.

| Phase | Measurement |
|-------|-------------|
| Authentication | `authenticateAndResolveStore` |
| Database | Prisma queries inside loader sections |
| API | Shopify / external calls (minimal on shell routes) |
| Render | Client hydration (not server-measured) |

**Production before/after:** NOT VERIFIED — requires Vercel log capture post-deploy.

---

## Route profiles (architectural analysis)

### Dashboard (`/app`)

| Segment | Before | After (this sprint) |
|---------|--------|---------------------|
| Auth | `authenticateAdminOnce` | `resolveRequestStoreContext` (auth + store once) |
| Store lookup | Separate `findUnique` | Cached in request context |
| Shell DB | 3 parallel + blocking metrics (7 counts on miss) | 3 parallel + **non-blocking metrics** |
| Intelligence | Deferred on document SSR | Unchanged (7 sections on `.data`) |
| **Target shell** | ~1.5–3s (pool contention) | **<1.5s** (fewer blocking queries) |

**Critical path:** Auth → Store → Hero → Health → Revenue → Sync → Render

---

### Executive (`/app/executive`)

| Segment | Before | After |
|---------|--------|-------|
| Auth + store | Duplicate per navigation | Request-scoped context |
| Shell + workspace | Sequential (shell then 6 fetches) | **Parallel** (7-way Promise.all) |
| Document SSR | Full loader blocked | **Shell only** → client `.data` revalidation |
| Bundle | Static import of all workspace views | **Lazy** `intelligence-workspace-views` |

---

### Predictions / Experiments / Merchant Intelligence

Same pattern as Executive via `createFeatureGatedWorkspaceLoader`:
- Document SSR → currency shell + skeleton
- `.data` → full workspace payload
- Feature gate evaluated only on `.data` request

---

### Root Cause / Knowledge Graph / Business Memory

| Route | Parallel fetches (after) |
|-------|--------------------------|
| Root causes | shell + 4 |
| Knowledge graph | shell + 2 |
| Business memory | shell + 6 |

---

### Products / Collections

| Route | Notes |
|-------|-------|
| Products | shell + product list in parallel |
| Collections | shell + KG nodes in parallel |
| Product detail | Removed wasteful shell on 404; parallel shell + graph |

---

### Settings / Billing

| Route | Change |
|-------|--------|
| Billing | `resolveRequestStoreContext` — eliminates duplicate auth + store |
| Settings | Unchanged (future: migrate to shared context) |

---

### COO (`/app/coo`)

| Before | After |
|--------|-------|
| Sequential: reminders → executive dashboard | **Parallel** Promise.all |

---

## Performance budget targets

| Metric | Target | Status |
|--------|--------|--------|
| Dashboard shell | <1.5s | ⏳ NOT VERIFIED |
| Navigation | <300ms perceived | ⏳ NOT VERIFIED |
| Workspace first render | <500ms shell | Architecture in place |
| AI workspaces | Stream after shell | ✅ Implemented |

---

## Recommendations (future)

1. Migrate `app.settings.tsx` to `resolveRequestStoreContext`
2. Batch intelligence `.data` sections (2–3 at a time) under `connection_limit=1`
3. Short-TTL cache for `loadWorkspaceShell` search/timeline per storeId
