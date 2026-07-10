# Regression Report — P0 Install Crash Fix

**Date:** 2026-07-10  
**Scope:** Automated tests for SSR intelligence guard

---

## New tests

| Test file | Tests | Result |
|-----------|-------|--------|
| `app/lib/__tests__/react-router-request.test.ts` | 2 | ✅ Pass |
| `app/routes/__tests__/p0-install-crash-dashboard.test.ts` | 2 | ✅ Pass |

### Coverage

1. **`isReactRouterDataRequest`**
   - Returns `true` for `/app.data` and nested `*.data` paths
   - Returns `false` for document `/app`

2. **Dashboard loader SSR guard**
   - Document request (`GET /app`): `deferIntelligenceLoad === true`, intelligence loaders **not invoked**
   - Data request (`GET /app.data`): intelligence loaders **invoked** with correct store/onboarding args

---

## Existing tests (spot check)

| Test file | Result |
|-----------|--------|
| `app/routes/__tests__/f45-dashboard-onboarding.test.ts` | Not re-run in this pass (no loader contract change for shell fields) |

---

## Manual regression matrix (Phase 8 — pending deploy)

| Scenario | Status | Notes |
|----------|--------|-------|
| Fresh install (new dev store) | ⏳ Pending MV-1 | Requires browser + Partner Dashboard |
| Existing merchant dashboard | ⏳ Pending post-deploy | Expect shell + client intelligence load |
| Reinstall same store | ⏳ Pending | |
| Expired session | ⏳ Pending | |
| Incognito | ⏳ Pending | |
| Multiple tabs | ⏳ Pending | |
| Dashboard refresh (hard reload) | ⏳ Pending | Should render shell, then revalidate |
| Background bootstrap completes | ⏳ Pending | Worker logs `[post-auth-bootstrap]` |

---

## Production verification commands (post-deploy)

```powershell
# Error logs should not show SSR abort on GET /app for fresh install
npx vercel logs store-pilot-eta.vercel.app --level error --since 30m --expand

# Health remains green
Invoke-WebRequest https://store-pilot-eta.vercel.app/health/ready
```

---

## Certification

Automated regression: **PASS** (4/4 new tests)  
Production regression: **NOT CERTIFIED** — awaiting deploy + MV-1
