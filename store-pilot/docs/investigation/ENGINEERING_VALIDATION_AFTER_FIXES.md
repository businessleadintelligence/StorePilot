# Engineering Validation After Fixes

**Generated:** 2026-07-11 00:42 IST  
**Branch / tree:** Local working tree (includes P0 install crash fixes + stabilization pass)

---

## Fixes applied (Phase 2)

| Fix | File | Change |
|-----|------|--------|
| 1 | `scripts/load-test/seed-via-app-session.ts` | Import `token-crypto.server` without `.ts` extension |
| 2 | `scripts/load-test/seed-via-app-session.ts` | Use `count` in startup log (`requestedCount`) |
| 3 | `app/lib/__tests__/react-router-request.test.ts` | Remove unused `vi` import |
| 4 | `app/routes/app._index.tsx` | Destructure `{ revalidate, state }` from `useRevalidator()` for exhaustive-deps |

### Fix 4 — `revalidator` dependency rationale

The full `revalidator` object from `useRevalidator()` gets a **new reference on many renders**. Including it in the dependency array caused repeated `revalidate()` calls and a `/app.data` request storm (observed in production Vercel logs).

**Correct dependencies:** `revalidate` and `revalidatorState` (stable primitives from React Router) plus `deferIntelligenceLoad`. Combined with `intelligenceRevalidatedRef`, intelligence loads **once** after document SSR.

---

## Additional stabilization (Phase 9)

| File | Change |
|------|--------|
| `app/lib/route-loader-log.server.ts` | Structured `[route-loader]` logging with shop, storeId, requestId, stack |
| `app/routes/app._index.tsx` | Loader try/catch → `EMPTY_SHELL`; deferred intelligence `.catch()` → `null` |
| `app/routes/app.tsx` | Layout loader error logging |
| `app/shopify.server.ts` | afterAuth error logs include stack trace |

---

## Validation results (post-fix)

### TypeScript

```bash
npm run typecheck
```

**Result:** ✅ **0 errors** (exit code 0)

### ESLint

```bash
npm run lint
```

**Result:** ✅ **0 errors, 0 warnings** (exit code 0)

### Tests

```bash
npm test
```

**Result:** ✅ **3038 / 3038 passed** (283 test files, 76.69s)

### Build

```bash
npm run build
```

**Result:** ✅ **Success**

---

## Target checklist

| Target | Status |
|--------|--------|
| TypeScript 0 errors | ✅ |
| ESLint 0 errors | ✅ |
| ESLint 0 warnings | ✅ |
| Tests 100% | ✅ 3038/3038 |
| Build success | ✅ |

---

## Production environment (Phase 8 spot check)

`GET https://store-pilot-eta.vercel.app/health/ready` — **200**

Verified present via readiness checks:

- `TOKEN_ENCRYPTION_KEY` (token_encryption_key + roundtrip)
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `DATABASE_URL`
- `SCOPES`
- `CRON_SECRET`
- `SHOPIFY_APP_URL` / webhook config (webhook_registration_config)
- Migrations applied

`DIRECT_URL` and `AI_PLATFORM_ENABLED` are not exposed on `/health/ready`; not validated in this pass.

---

## Manual production verification (pending)

Fresh Shopify dev store → install → dashboard without `Unexpected Server Error` — **requires merchant browser test** after latest deploy.
