# StorePilot — Real Store Performance Report

**Sprint:** Real Store Validation v1.0  
**Date:** 2026-06-29  
**Target:** <300ms cached dashboard loads  
**Status:** **NOT MEASURED** — application build blocked

---

## Summary

No live performance measurements were collected against the Shopify Development Store. The deployed application at `https://store-pilot-eta.vercel.app` serves a static marketing/login page only; embedded dashboard loaders could not be exercised.

| Surface | Measured | Target | Result |
|---------|----------|--------|--------|
| Dashboard (`/app`) | — | <300ms cached | ⏭️ NOT EXECUTED |
| Command Center | — | <300ms cached | 🚫 Route missing |
| Executive Dashboard | — | <300ms cached | 🚫 Route missing |
| Connector sync | — | — | ⏭️ NOT EXECUTED |
| AI execution | — | — | 🚫 Build blocked |
| Automation execution | — | — | 🚫 Route missing |
| Operations load | — | — | 🚫 Route missing |
| Billing dashboard | — | — | 🚫 Route missing |
| Onboarding | — | — | 🚫 Route missing |
| System Health | — | — | 🚫 Route missing |

---

## Automated Baseline (Non-Production)

| Check | Duration | Result |
|-------|----------|--------|
| `npm test` (full suite) | ~22s | ❌ 72 files failed |
| `npm run typecheck` | ~52s | ❌ Failed |
| `npx prisma generate` | ~27s | ❌ Schema invalid |
| Production URL fetch (`/`) | <2s | ✅ 200 — template page |

---

## Memory / CPU

| Measurement | Result |
|-------------|--------|
| Node heap during test run | ⏭️ NOT PROFILED |
| Worker memory under sync | ⏭️ NOT EXECUTED |
| Large catalog sync memory | ⏭️ NOT EXECUTED |

---

## Database Queries

| Query path | Status |
|------------|--------|
| Dashboard aggregation | 🚫 Cannot profile — loader returns null |
| Webhook lookup indexes | ⚠️ Cannot verify — schema incomplete vs migration set |
| Job queue claim path | 🚫 `SyncJob` model absent from schema |

---

## Slow Endpoints

No production APM data available for this validation session.

**Recommendation:** After build restoration, measure with:

1. Browser DevTools → Network tab in embedded app (cold + warm load)
2. Server timing logs on loader functions
3. `EXPLAIN ANALYZE` on top 5 dashboard queries

---

## Performance Risks Identified (Static Analysis)

| Risk | Severity | Notes |
|------|----------|-------|
| Dashboard shows N/A without caching layer wired | Medium | BUG-005 |
| Missing TimedCache on active dashboard route | Medium | Cache may exist in services but route not connected |
| Test suite import time 55s | Low | Dev experience; not production runtime |

---

## Re-test Checklist (Post-Fix)

- [ ] Dashboard cold load < 2s, warm load < 300ms
- [ ] Command Center cached load < 300ms
- [ ] Executive Dashboard cached load < 300ms
- [ ] Connector full sync time documented per connector
- [ ] AI agent p95 latency documented per agent
- [ ] Automation mutation end-to-end < 10s including verification

---

## Conclusion

**Performance validation incomplete.** Cannot score against <300ms target until embedded app runs on dev store with restored routes and green build.
