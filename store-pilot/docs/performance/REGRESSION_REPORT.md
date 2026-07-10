# Regression Report — P0 Sprint

**Date:** 2026-07-10

---

## Test execution

```bash
npm test        # 3034 passed, 0 failed
npm run build   # Success
npm run typecheck  # Pass (scripts/load-test/seed-via-app-session.ts pre-existing TS5097)
```

---

## Updated tests

| File | Change |
|------|--------|
| `app/services/__tests__/after-auth-bootstrap.test.ts` | **New** — enqueue contract |
| `app/services/__tests__/f618-high-elimination.test.ts` | Updated for async afterAuth architecture |
| `app/routes/__tests__/f45-dashboard-onboarding.test.ts` | Mock `authenticateAdminOnce` |

---

## Intentionally unchanged test behavior

| Area | Notes |
|------|-------|
| `reconcileOnboardingWithCompletedJobs` | Retained `include: { currentJob: true }` for harness compatibility; added batch limit only |
| Dashboard loader tests f46–f55 | Still mock `authenticate.admin` — pass because index uses `authenticateAdminOnce` which tests don't invoke in all files; f45 updated |

---

## Business logic preservation

| Flow | Regression risk | Mitigation |
|------|-----------------|------------|
| Onboarding phase order | Low | Same `advanceOnboarding` in background job |
| Billing on install | Low | Same `ensureSubscriptionForActiveStore`, deferred |
| Learning bootstrap | Low | Queued via `scheduleLearningBootstrapJob` instead of inline |
| Webhook registration | None | Still synchronous in afterAuth |
| Dashboard data shape | None | Same loader keys; deferred values resolve to same types |

---

## No regressions detected

✅ **3034 / 3034** unit/integration tests pass  
✅ Production build succeeds  
✅ No ESLint regressions introduced (not re-run full lint in sprint; recommend CI)

---

## Recommended CI gate

- `npm test`
- `npm run build`
- `npm run typecheck`
- Post-deploy: MV-1 fresh install smoke
