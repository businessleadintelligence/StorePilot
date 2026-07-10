# Root Cause Analysis — P0 Fresh Install Crash

**Incident:** P0-INSTALL-20260710  
**Root cause status:** **Confirmed with Vercel stack trace evidence**

---

## Executive summary

Commit `fc584ba` refactored the dashboard loader to return **unresolved Promises** for seven intelligence sections (learning, quick wins, executive, root cause, prediction, experiments, merchant intelligence) intended for streaming via `<Suspense>` / `<Await>`.

On **first embedded document load** (`GET /app`), all seven promises **start executing immediately**, each issuing parallel Prisma queries, while the loader also awaits onboarding, sync status, and metrics. With production `DATABASE_URL` configured as `connection_limit=1` and `pool_timeout=15`, queries queue behind a single connection. Session lookup alone took **13.4s**. React SSR hit its **abort timer** before Suspense boundaries resolved:

> `Error: The render was aborted by the server without a reason.`

Shopify App Bridge renders this as **Unexpected Server Error**.

This is **not** an OAuth failure, **not** a missing migration, and **not** a thrown null-reference in business logic. It is **SSR timeout caused by concurrent DB fan-out on a single-connection serverless pool**.

---

## Phase 2 — Exact execution path

```
Shopify Partner Dashboard → Install
        ↓
OAuth callback (/auth/callback)
        ↓
afterAuth() — shopify.server.ts L67–128
        ├─ upsertStoreFromSession()          [sync, required]
        ├─ registerWebhooks()                [sync, best-effort]
        └─ schedulePostAuthBootstrapJob()    [sync enqueue only]
        ↓
Redirect to embedded /app
        ↓
app/routes/app.tsx loader
        └─ authenticateAdminOnce()           [Session findUnique]
        ↓
app/routes/app._index.tsx loader  ← FAILURE ZONE
        ├─ authenticateAdminOnce()           [cached per Request]
        ├─ prisma.store.findUnique()
        ├─ Promise.all([
        │     getOnboardingStatus(),
        │     getStoreSyncStatus(),
        │     getStoreMetrics(),             [cache miss → 7 parallel counts on fresh store]
        │   ])
        ├─ calculateStoreHealthScore()       [sync]
        ├─ build insights/recommendations    [sync]
        └─ WITHOUT AWAIT — fires immediately:
              getLearningBootstrapForUi()     → LearningVelocity findMany
              getQuickWinsForDashboard()      → QuickWin findMany
              getExecutiveDashboardForUi()    → ExecutiveDecision findMany
              getRootCauseDashboardForUi()    → RootCause findMany
              getPredictionDashboardForUi()   → Prediction findMany
              getExperimentDashboardForUi()   → Experiment findMany
              getMerchantIntelligenceDashboardForUi() → MerchantTimeline findMany
        ↓
React SSR renders <Suspense>/<Await> for each promise
        ↓
Pool exhaustion + slow queries (13s+ Session, 5–6s intelligence)
        ↓
react-dom-server abort timer fires
        ↓
app.tsx ErrorBoundary → boundary.error() → "Unexpected Server Error"
```

**Execution stops at:** React DOM server abort (`react-dom-server.node.production.min.js:102:385`) — not at a specific application line throw, but triggered by **`app/routes/app._index.tsx` loader L184–194** (pre-fix) starting unbounded parallel DB work during document SSR.

---

## Phase 3 — Dependency validation (incident store)

Evidence from Vercel logs for `varsha-cf8clnuz.myshopify.com`:

| Dependency | Evidence in logs | Status |
|------------|------------------|--------|
| **Session** | `Session findUnique` (13.4s) | ✅ Exists (slow) |
| **Store** | `Store findUnique` (1.5–4.4s) | ✅ Exists |
| **StoreOnboarding** | `StoreOnboarding findUnique` | ✅ Exists |
| **StoreMetricsCache** | `StoreMetricsCache findUnique` | ✅ Table reachable |
| **Product / Order** | `count` operations | ✅ Empty store (0 rows OK) |
| **LearningVelocity** | `findMany` | ✅ Empty result set |
| **QuickWin, Experiment, RootCause, etc.** | `findMany` | ✅ Empty result sets |
| **Prisma migrations** | `/health/ready` migrations check OK | ✅ |
| **Env vars** | Auth succeeded, DB queries ran | ✅ |
| **Billing / KnowledgeGraph / MerchantBaseline** | Not queried on dashboard index path | N/A for this crash |

**Conclusion:** Dependencies exist. Crash is **not** missing rows — it is **too many concurrent reads** on a **1-connection pool** during SSR.

---

## Phase 4 — New store empty-state analysis

Fresh stores correctly return empty arrays for intelligence queries (logs show findMany, not "table not found"). The loader **does not throw** on empty DB for individual services.

**Failure mode:** Empty store still triggers:
- `getStoreMetrics()` cache miss → `recomputeStoreMetricsCache()` → **7 parallel counts**
- **7 intelligence UI loaders** → **7+ parallel findMany**

Empty data does not short-circuit these code paths in `fc584ba`.

---

## Phase 5 — afterAuth assessment

| Operation | Sync/async | Blocks redirect? | Can crash merchant redirect? |
|-----------|------------|----------------|------------------------------|
| `upsertStoreFromSession` | Sync | Yes | Only if throw — caught, logged, returns |
| `registerWebhooks` | Sync | Yes | Caught — continues |
| `schedulePostAuthBootstrapJob` | Sync enqueue | Yes | Caught — continues |

**afterAuth is NOT the direct crash cause** for this incident. Logs show successful auth and store queries **after** redirect to `/app`.

Background bootstrap (billing, onboarding advance, backfill) runs in worker via `onboarding_bootstrap` job — correctly off hot path.

---

## Phase 6 — Authentication (`accounts.shopify.com refused to connect`)

This is a **separate symptom**, same install session:

| Cause | Mechanism |
|-------|-----------|
| Embedded iframe loads Shopify account login | Session token missing/expired; App Bridge attempts account login **inside iframe** |
| Browser blocks | `accounts.shopify.com` sets `X-Frame-Options` / CSP — **refused to connect** |
| Recovery attempt hits `/app` | SSR crash → **Unexpected Server Error** |

**Not a redirect loop** in logs. Sequence: auth INFO lines → `/app` SSR abort.

Mitigation for auth symptom remains: ensure session established before iframe render (existing `authenticateAdminOnce` + App Bridge). Primary merchant blocker for this incident is **SSR abort**, not OAuth rejection.

---

## Contributing factors

| Factor | Role |
|--------|------|
| `fc584ba` dashboard deferred promises | **Primary trigger** — 7 parallel intelligence queries on document SSR |
| `connection_limit=1` pool config | **Amplifier** — serializes parallel Prisma, 15s queue timeout |
| Cold DB latency (Session 13s) | **Amplifier** — pool contention / Supabase latency |
| Vercel SSR abort timer | **Mechanism** — converts slow render to hard error |
| Shopify `boundary.error()` | **UX** — masks abort as "Unexpected Server Error" |

---

## Root cause statement

> **The dashboard index loader (`app._index.tsx`) started seven intelligence data fetches as unresolved Promises during the initial document SSR request (`GET /app`). Combined with synchronous shell queries and a single-connection Prisma pool, React server rendering exceeded its abort timeout, producing `Error: The render was aborted by the server without a reason`, which Shopify's error boundary displays as Unexpected Server Error to the merchant.**

---

## Fix direction (minimal)

1. **Do not invoke intelligence DB loaders on document SSR** (`GET /app`) — return null shell.
2. **Load intelligence after hydration** via React Router `.data` revalidation (`GET /app.data`).
3. No architecture redesign; no performance sprint scope.

See [FIX_IMPLEMENTATION.md](./FIX_IMPLEMENTATION.md).
