# Production Runtime Crash — Root Cause

**Generated:** 2026-07-11 00:45 IST  
**Evidence source:** Vercel production runtime logs (not TypeScript/ESLint audits)

---

## Executive summary

Fresh Shopify merchants completed OAuth successfully but saw **Something went wrong / Unexpected Server Error** when opening the embedded app. **This was not caused by TypeScript or ESLint issues.**

The confirmed runtime failure was **React SSR abort** on `GET /app` caused by the dashboard loader firing **7+ parallel intelligence DB queries** during document render, combined with **`connection_limit=1`** Prisma pool configuration on Vercel serverless. Session lookups exceeded **13 seconds**; React DOM server hit its abort timer:

```
Error: The render was aborted by the server without a reason.
```

A **secondary failure** on `GET /app/coo` was **Prisma P2024** pool timeout via `getProductionHealthDashboard()` triggered from onboarding reminders.

---

## Root cause

| Field | Value |
|-------|-------|
| **Primary route** | `GET /app` |
| **Primary file** | `app/routes/app._index.tsx` |
| **Primary function** | `loader()` — returned unresolved intelligence Promises during document SSR |
| **Failure mechanism** | `react-dom-server` abort timer (`Timeout.abort`) — not an application `throw` |
| **Exception** | `Error: The render was aborted by the server without a reason.` |
| **Contributing config** | `DATABASE_URL` with `connection_limit=1`, `pool_timeout=15` |
| **Incident shop (logs)** | `varsha-cf8clnuz.myshopify.com` |
| **Timestamp (UTC)** | 2026-07-10 23:07:59 |

### Secondary root cause (COO navigation)

| Field | Value |
|-------|-------|
| **Route** | `GET /app/coo.data` |
| **File** | `app/onboarding/onboarding-recommendations.ts` → `app/production/production-engine.ts` |
| **Function** | `buildOnboardingReminders()` → `getProductionHealthBadge()` → `runProductionHealthEngine()` |
| **Exception** | `PrismaClientKnownRequestError` code **P2024** |
| **Model** | `AiResultCacheEntry.count()` (among 13 parallel subsystem monitors) |

---

## Request trace (confirmed)

```
Shopify Install
  ↓
OAuth Callback (/auth/callback)
  ↓
afterAuth() — shopify.server.ts
  ├─ upsertStoreFromSession()     ✅ (sync, caught on failure)
  ├─ registerWebhooks()           ✅ (best-effort)
  └─ schedulePostAuthBootstrapJob() ✅ (enqueue only)
  ↓
Redirect → GET /app
  ↓
app/routes/app.tsx loader
  └─ authenticateAdminOnce()
  ↓
app/routes/app._index.tsx loader  ← PRIMARY FAILURE ZONE (pre-fix)
  ├─ onboarding + sync + metrics (awaited)
  └─ 7 intelligence loaders started immediately (unawaited Promises)
  ↓
React SSR <Suspense>/<Await> waits on Promises
  ↓
15+ concurrent Prisma ops on 1 connection
  ↓
SSR abort → app.tsx ErrorBoundary → boundary.error()
  ↓
Merchant sees: "Unexpected Server Error"
```

**afterAuth did not block or throw** on the happy path (store/session queries appear in logs after redirect).

---

## Why previous audits missed it

| Audit type | Why it missed the crash |
|------------|-------------------------|
| TypeScript | Compile-time only — no SSR timing or pool behavior |
| ESLint | Static analysis — no runtime query fan-out |
| Unit tests | Mock DB — no connection pool, no SSR abort timer |
| Health endpoints | Do not execute dashboard loader path |
| `/health/ready` green | Validates env/migrations, not merchant UI SSR |

The crash required **Vercel runtime logs with expanded stack traces** (`vercel logs --level error --expand`).

---

## Empty store assumptions (Phase 5)

Fresh stores return **empty arrays** from intelligence queries — they did **not** throw on missing rows. The crash was **concurrency + SSR timeout**, not `null.foo` access.

Loaders already return `EMPTY_SHELL` when shop/store missing. Gap was **heavy parallel reads on empty stores** still saturating the pool.

---

## Deferred dashboard (Phase 6)

Pre-fix: unresolved Promises from intelligence loaders could reject into Suspense → error boundary.

Post-fix:
- Document SSR (`GET /app`): intelligence **not invoked**
- Data SSR (`GET /app.data`): each section wrapped in `deferIntelligenceSection()` → resolves **`null`** on failure
- Loader outer try/catch → **`EMPTY_SHELL`** on failure

---

## Fixes implemented

| Fix | Description |
|-----|-------------|
| SSR guard | `isReactRouterDataRequest()` — skip intelligence DB on document load |
| Client revalidation | Single post-hydration `revalidate()` for intelligence |
| Revalidation storm | `useRef` + stable `revalidate`/`state` deps |
| COO / reminders | `getCachedProductionBadge()` only — no full health engine on COO |
| Production engine | Sequential subsystem monitors + per-step error isolation |
| COO loader | try/catch on executive dashboard |
| Logging | `[route-loader]` structured logs with shop, storeId, requestId, stack |
| Loader safety | Dashboard loader returns empty shell instead of throwing |

Deployments:
- `dpl_6gUVVFcFdWGuWBs7GDWiwdUycHgn` — dashboard SSR guard
- `dpl_4bskugD57MbEDmL9CmXKW7zamgqN` — COO + revalidation fixes
- Latest stabilization deploy — logging + deferred `.catch()` + engineering fixes

---

## Regression prevention

1. `app/routes/__tests__/p0-install-crash-dashboard.test.ts` — document SSR must not call intelligence loaders
2. `[route-loader]` logs on every dashboard failure with stack trace
3. Engineering gate: typecheck + lint + 3038 tests + build (see ENGINEERING_VALIDATION_AFTER_FIXES.md)

---

## Validation status

| Check | Status |
|-------|--------|
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm test` | ✅ 3038/3038 |
| `npm run build` | ✅ Success |
| Fresh store → dashboard (manual) | ⏳ Pending merchant re-test |

---

## Related documents

- `docs/incidents/STACK_TRACE_ANALYSIS.md` — full Vercel stack traces
- `docs/incidents/ROOT_CAUSE_ANALYSIS.md` — incident timeline
- `docs/investigation/CURRENT_ENGINEERING_STATUS.md` — engineering baseline
- `docs/investigation/ENGINEERING_VALIDATION_AFTER_FIXES.md` — post-fix gate
