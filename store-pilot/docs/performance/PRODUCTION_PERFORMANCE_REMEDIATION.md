# Production Performance Remediation — P0 Sprint

**Date:** 2026-07-10  
**Sprint:** Production Stabilization (P0)  
**Scope:** Auth, dashboard, database, worker — no feature changes

---

## Summary

This sprint eliminates the three production bottlenecks identified in `docs/investigation/PRODUCTION_PERFORMANCE_AND_AUTH_INVESTIGATION.md`:

| Area | Before | After |
|------|--------|-------|
| OAuth callback | 10+ synchronous steps including Shopify GraphQL | Store upsert + webhooks + enqueue job |
| Dashboard loader | 35–45 queries, 7 sequential intelligence fetches | ~15 blocking queries; intelligence streamed |
| Queue metrics | 7× `COUNT(status)` per health/cron probe | 1× `GROUP BY status` |
| Client index chunk | 44.5 KB | 28.1 KB (+ lazy splits) |

---

## Changes by part

| Part | Deliverable doc | Status |
|------|-----------------|--------|
| 1 Auth refactor | `AUTH_REMEDIATION.md` | ✅ Implemented |
| 2 Dashboard performance | `DASHBOARD_REMEDIATION.md` | ✅ Implemented |
| 3 Database optimization | `DATABASE_REMEDIATION.md`, `QUERY_OPTIMIZATION_REPORT.md` | ✅ Implemented |
| 4 Auth hardening | `AUTH_REMEDIATION.md` | ✅ Implemented |
| 5 Performance targets | `PERFORMANCE_BEFORE_AFTER.md` | 🟡 Partial — live LCP pending |
| 6 Code quality | This doc | ✅ Duplicate auth removed |
| 7 Regression testing | `REGRESSION_REPORT.md` | ✅ 3034/3034 tests pass |
| 8 Certification | `PERFORMANCE_CERTIFICATION.md` | 🟡 Requires production deploy |
| 9–10 Self-review | `FINAL_ENGINEERING_CERTIFICATE.md` | See certificate |

---

## Architecture shift

```
BEFORE: OAuth → [everything sync] → Dashboard [everything sync] → Paint
AFTER:  OAuth → [store + webhooks] → Redirect → Dashboard shell → Paint
                                              ↘ worker: onboarding_bootstrap
                                              ↘ stream: intelligence sections
```

---

## Deployment checklist

1. Deploy to Vercel production
2. Run `prisma migrate deploy` (index migration `20260710160000_p0_query_performance_indexes`)
3. Set `DATABASE_URL` with `connection_limit=1&pool_timeout=15&pgbouncer=true`
4. Execute MV-1 fresh install on dev store
5. Measure LCP on `/app` with Chrome DevTools
6. Confirm `[post-auth-bootstrap]` and `[after-auth]` logs in Vercel

---

## Related documents

- Investigation: `docs/investigation/PRODUCTION_PERFORMANCE_AND_AUTH_INVESTIGATION.md`
- Auth: `docs/performance/AUTH_REMEDIATION.md`
- Dashboard: `docs/performance/DASHBOARD_REMEDIATION.md`
- Database: `docs/performance/DATABASE_REMEDIATION.md`
- Queries: `docs/performance/QUERY_OPTIMIZATION_REPORT.md`
- Metrics: `docs/performance/PERFORMANCE_BEFORE_AFTER.md`
- Tests: `docs/performance/REGRESSION_REPORT.md`
- Certificate: `docs/performance/FINAL_ENGINEERING_CERTIFICATE.md`
