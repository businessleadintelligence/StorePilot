# Dashboard Remediation — P0 Sprint

**Date:** 2026-07-10

---

## Problem

`app/routes/app._index.tsx` blocked first paint for ~18–19 seconds:

- 35–45 database queries
- 7 intelligence workspace fetches **sequential**
- Duplicate authentication
- All intelligence cards in one SSR response

---

## Solution

### Blocking shell (fast path)

Loaded synchronously before HTML flush:

- Store lookup
- Onboarding status
- Sync status
- Store metrics + health score
- Executive brief, insights, recommendations (CPU-only from metrics)
- **PremiumHero** (LCP candidate)

### Deferred intelligence (streaming)

Returned as **Promises** in loader data; rendered with `Suspense` + `Await`:

- `learningBootstrap`
- `quickWins`
- `executiveDashboard`
- `rootCause`
- `prediction`
- `experiments`
- `merchantIntelligence`

### Lazy client components

`React.lazy()` for intelligence card modules — splits client bundle:

| Chunk | Before | After |
|-------|--------|-------|
| `app._index` main | 44.5 KB | 28.1 KB |
| `app._index` stub | — | 0.28 KB |

Intelligence UI loads in separate async chunks on hydration.

### Skeleton UI

`DeferredSectionSkeleton` (`app/components/dashboard/DeferredSectionSkeleton.tsx`) shown during Suspense fallback.

---

## Loader waterfall (after)

```
authenticateAdminOnce (cached if parent ran)
store.findUnique
Promise.all: onboarding + syncStatus + metrics  ← blocking
CPU: healthScore, brief, insights, recommendations
RETURN HTML with hero + workspace links
--- stream ---
learningBootstrap → quickWins → executive → rootCause → prediction → experiments → merchantIntelligence
```

Estimated blocking queries: **~12–15** (down from 35–45).

---

## Verification status

| Metric | Status |
|--------|--------|
| Build succeeds | ✅ |
| Unit tests (dashboard loaders) | ✅ 3034 pass |
| LCP < 3s | 🟡 Requires production deploy + DevTools |
| Streaming visible in Network tab | 🟡 Requires production deploy |

---

## Files changed

- `app/routes/app._index.tsx` — deferred promises, Suspense, lazy imports
- `app/components/dashboard/DeferredSectionSkeleton.tsx` — **new**
- `app/components/dashboard/premium-dashboard.module.css` — skeleton styles
- `app/lib/request-auth.server.ts` — single auth per request
