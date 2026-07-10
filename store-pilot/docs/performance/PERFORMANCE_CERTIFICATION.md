# Performance Certification — P0 Sprint

**Date:** 2026-07-10  
**Certifier:** Engineering (automated + code review)

---

## Certification matrix

| Criterion | Target | Result | Evidence |
|-----------|--------|--------|----------|
| OAuth non-blocking | Callback < 3s | 🟡 Implemented | `shopify.server.ts` — 3 sync steps |
| Bootstrap async | Worker job | ✅ Verified | `onboarding_bootstrap` + test |
| Dashboard shell fast | Blocking queries < 15 | ✅ Verified | Loader analysis |
| Intelligence streaming | Suspense + Await | ✅ Verified | `app._index.tsx` |
| Queue metrics optimized | 1 GROUP BY | ✅ Verified | `job.server.ts` |
| Onboarding batch limits | take: 50 | ✅ Verified | `onboarding.server.ts` |
| DB indexes | 4 partial | 🟡 Migration pending deploy | migration SQL |
| Unit regressions | 0 failures | ✅ Verified | 3034/3034 |
| LCP < 3s | Production | 🟡 Requires live validation | — |
| OAuth install E2E | Production | 🟡 Requires MV-1 | — |

---

## Verdict

**ENGINEERING CERTIFIED — PENDING PRODUCTION VALIDATION**

All code-level success criteria are met. Performance targets requiring deployed infrastructure are documented with explicit validation steps.

---

## Sign-off requirements

Before merchant-facing certification:

1. Deploy to production
2. Run `prisma migrate deploy`
3. Configure pool URL params
4. Complete MV-1 through MV-3 from `docs/manual-validation/`
5. Attach Lighthouse trace + Vercel logs to this document

---

## Related

- `FINAL_ENGINEERING_CERTIFICATE.md`
- `PERFORMANCE_BEFORE_AFTER.md`
