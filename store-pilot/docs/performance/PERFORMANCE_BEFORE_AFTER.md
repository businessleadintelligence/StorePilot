# Performance Before / After — P0 Sprint

**Date:** 2026-07-10  
**Build:** Local workspace post-sprint

---

## Methodology

| Measurement | Before source | After source |
|-------------|---------------|--------------|
| Investigation metrics | `docs/investigation/PRODUCTION_PERFORMANCE_AND_AUTH_INVESTIGATION.md` | — |
| Bundle sizes | Pre-sprint `npm run build` | Post-sprint `npm run build` |
| Tests | — | `npm test` 2026-07-10 |
| Live TTFB | curl `/health/live` pre-deploy | curl `/health/live` (production not yet redeployed with sprint) |

---

## Dashboard

| Metric | Before (investigation) | After (expected) | Verified |
|--------|------------------------|------------------|----------|
| LCP | ~18–19 s | **< 3 s target** | 🟡 Live validation |
| TTFB (dashboard `/app`) | ~14–16 s est. | **< 2 s target** | 🟡 Live validation |
| Blocking DB queries | 35–45 | ~13 | ✅ Code analysis |
| Intelligence blocking | 7 sequential | 0 (streamed) | ✅ Code analysis |
| Duplicate auth | 2× per request | 1× (cached) | ✅ Code analysis |

---

## Database

| Metric | Before (live monitor) | After (expected) | Verified |
|--------|----------------------|------------------|----------|
| p95 query (instance) | 10,547 ms | < 500 ms target | 🟡 Post-deploy |
| Queue metric queries | 7 × count | 1 × GROUP BY | ✅ Code |
| SELECT 1 latency | 6,795 ms | < 100 ms with pool fix | 🟡 Env + deploy |

---

## Bundle

| Asset | Before | After | Delta |
|-------|--------|-------|-------|
| Client `app._index` | 44.5 KB | 28.1 KB | **−37%** |
| Client `entry.client` | 137.6 KB | 141.0 KB | +2.5% |
| Server bundle | 2,548 KB | 2,517 KB | **−1.2%** |

Intelligence cards now lazy-loaded in separate chunks.

---

## Auth / onboarding

| Metric | Before | After | Verified |
|--------|--------|-------|----------|
| afterAuth sync steps | 10+ | 3 | ✅ Code |
| OAuth callback GraphQL | Inline bootstrap | Queued `learning_bootstrap` | ✅ Code |
| Callback timeout risk | High | Low | 🟡 Live install |

---

## Worker / cron

| Metric | Before | After | Verified |
|--------|--------|-------|----------|
| Queue metrics per health check | 7 queries | 1 query | ✅ Code |
| Onboarding reconcile batch | Unbounded | 50 rows | ✅ Code |
| onboarding_bootstrap job | Unused enum | Active | ✅ Code + test |

---

## Tests

| Suite | Before | After |
|-------|--------|-------|
| Vitest | — | **3034 / 3034 pass** |
| Typecheck | — | Pass (pre-existing script warning only) |
| Build | — | Pass |

---

## Production validation steps (required)

1. Deploy sprint to `store-pilot-eta.vercel.app`
2. Apply DB migration
3. Update `DATABASE_URL` pool params
4. MV-1 fresh install — measure OAuth completion time
5. Chrome Lighthouse on `/app` — record LCP, TTFB
6. `GET /health/monitor` — compare p95 query duration
