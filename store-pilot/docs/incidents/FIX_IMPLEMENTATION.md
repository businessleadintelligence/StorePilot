# Fix Implementation — P0 Install Crash

**Incident:** P0-INSTALL-20260710  
**Fix type:** Targeted production hotfix (no speculative refactor)

---

## Problem

`app/routes/app._index.tsx` loader returned unresolved Promises for intelligence sections on **every** request, including the initial embedded document load. SSR attempted to stream all Suspense boundaries, firing 15+ concurrent Prisma operations against a `connection_limit=1` pool, causing React DOM server abort.

---

## Solution

### 1. Detect document vs data requests

**New file:** `app/lib/react-router-request.server.ts`

```typescript
export function isReactRouterDataRequest(request: Request): boolean {
  return new URL(request.url).pathname.endsWith(".data");
}
```

- Document load (embedded first paint): `GET /app` → `false`
- Client revalidation / navigation: `GET /app.data` → `true`

### 2. Skip intelligence DB on document SSR

**Modified:** `app/routes/app._index.tsx`

| Request type | Shell data (onboarding, metrics, sync) | Intelligence sections |
|--------------|----------------------------------------|------------------------|
| `GET /app` (document) | Loaded (required for first paint) | **`null` — no DB calls** |
| `GET /app.data` | Loaded | Promises returned (existing streaming behavior) |

Loader returns `deferIntelligenceLoad: true` on document requests so the client knows to revalidate.

### 3. Client revalidation after hydration

**Modified:** `app/routes/app._index.tsx` component

```typescript
useEffect(() => {
  if (!deferIntelligenceLoad || revalidator.state !== "idle") return;
  revalidator.revalidate();
}, [deferIntelligenceLoad, revalidator]);
```

After SSR shell renders successfully, client triggers `GET /app.data` to load intelligence cards without blocking first paint.

---

## Files changed

| File | Change |
|------|--------|
| `app/lib/react-router-request.server.ts` | New — request type helper |
| `app/lib/__tests__/react-router-request.test.ts` | New — unit tests |
| `app/routes/app._index.tsx` | SSR guard + client revalidation |
| `app/routes/__tests__/p0-install-crash-dashboard.test.ts` | New — regression tests |

---

## Explicitly NOT changed

- `afterAuth` / bootstrap architecture (already correct)
- DB pool URL configuration
- COO dashboard pool fan-out (`/app/coo` P2024 — separate follow-up if needed)
- Performance optimizations beyond incident scope
- UI redesign

---

## Expected behavior after fix

| Step | Before fix | After fix |
|------|------------|-----------|
| Fresh install → `/app` document | SSR abort → Unexpected Server Error | Shell renders (onboarding, empty metrics) |
| After hydration | N/A (crashed) | Client revalidates → intelligence cards stream in |
| `GET /app.data` | Worked (200) | Still works |

---

## Deployment status

**Deployed to production:** 2026-07-10 ~23:58 IST (COO + revalidation follow-up)

| Field | Value |
|-------|-------|
| Deployment ID | `dpl_4bskugD57MbEDmL9CmXKW7zamgqN` |
| Production URL | https://store-pilot-eta.vercel.app |
| Inspector | https://vercel.com/businessleadintelligences-projects/store-pilot/4bskugD57MbEDmL9CmXKW7zamgqN |

**Prior deploy:** `dpl_6gUVVFcFdWGuWBs7GDWiwdUycHgn` (dashboard SSR guard only)

### Follow-up fixes (COO crash)

| Issue | Fix |
|-------|-----|
| `/app/coo.data` P2024 pool timeout | Onboarding reminders no longer run full production health engine |
| `monitorAiPlatformHealth` parallel fan-out | Production health monitors run **sequentially** with per-step error isolation |
| Dashboard `/app.data` storm | Intelligence revalidation runs **once** (useRef guard) |
| COO loader hard failure | Executive dashboard load wrapped in try/catch; returns empty state instead of 500 |

Deploy + MV-1 revalidation required before certification. See [MV1_REVALIDATION.md](./MV1_REVALIDATION.md).

**Note:** Fix deployed via CLI from local working tree — not yet committed to `origin/main`.

---

## Rollback

Revert `app._index.tsx` intelligence guard and `react-router-request.server.ts`. Restore prior behavior (will restore crash on fresh install under pool contention).
