# Code Quality Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Dead Code Report

| Item | Path | Evidence | Recommendation |
|------|------|----------|----------------|
| Scaffold route | `app/routes/app.additional.tsx` | Shopify template; zero nav links | Remove or document as dev-only |
| Placeholder reports | `app/routes/app.reports.tsx` | "No daily briefing available yet" | Wire to executive workspace or remove |
| Placeholder issues | `app/routes/app.issues.tsx` | Empty state only; linked from dashboard | Wire to root-cause/predictions workspace |
| Duplicate worker runner | `scripts/f310-run-worker.ts`, `app/scripts/f310-run-worker.ts` | `npm run worker` uses `scripts/worker.ts` instead | Remove duplicates |
| V1 AI runner | `app/ai/core/ai-runner.ts` | Tests only per AI audit | Mark deprecated or remove |
| `trackInFlightJob` | `app/services/worker-runtime.server.ts` | Defined but never called | Wire for graceful shutdown or remove |
| `requeueDeadLetterJob` | `app/services/job.server.ts` | No route/UI consumer | Expose in system-health or remove |
| Legacy COO at `/app/coo` | `app/routes/app.coo.tsx` | Duplicates executive dashboard; kept for test compat | Document lifecycle; deprecate after migration |

---

## Duplicate Logic Report

| Duplication | Locations | Impact |
|-------------|-----------|--------|
| **Executive COO execution** | `app/executive/coo/coo-service.ts` (Foundation) vs `app/services/executive-coo.server.ts` (V2) | Split behavior, double prompts |
| **AI prompt loading** | `app/ai/foundation/prompt-registry/store.ts` vs `app/ai/prompts/file-prompt-loader.ts` | Two registries, version drift |
| **AI caching** | Foundation in-memory cache vs `app/ai/cache/result-cache.ts` (Prisma) | Inconsistent cache hits |
| **AI cost control** | Foundation `CostManager` vs `app/services/ai-cost-control.server.ts` | Split budget enforcement |
| **AI telemetry** | Foundation optional vs V2 `PrismaTelemetryWriter` | Incomplete observability on Foundation path |
| **Worker runners** | 3 entry scripts | Confusion for ops |
| **Currency formatting** | Inline in multiple UI cards vs `app/lib/format.ts` | Minor duplication |
| **Idempotency key builders** | Per-scheduler patterns in worker, onboarding, cron | Acceptable but undocumented convention |
| **Executive dashboard data** | `executive-dashboard.server.ts` vs `executive-ui.server.ts` vs `executive-api.ts` | Three layers serving overlapping DTOs |

---

## Unused API Report

| API / Export | Path | Status |
|--------------|------|--------|
| `getFoundationHealthReport()` | `app/ai/foundation/observability/health.ts` | No route consumer |
| `PrismaCostLedgerStore` | `app/ai/foundation/cost/prisma-cost-ledger.ts` | Never wired to Foundation client |
| `requeueDeadLetterJob()` | `app/services/job.server.ts` | Library-only |
| `findExpiredLockedJobs()` deprecated alias | `app/services/job.server.ts:397` | Marked `@deprecated` |
| `trend-intelligence.server.ts` | Worker/test paths only | Limited production surface |
| `growth-intelligence.server.ts` | Onboarding + tests only | Limited production surface |
| `store-audit.server.ts` | Onboarding pipeline only | No dedicated route |

---

## Large File Report (Refactoring Candidates)

| Lines | File | Issue |
|------:|------|-------|
| 3,724 | `app/services/__tests__/setup/vitest.setup.ts` | Test harness god-file |
| 2,184 | `app/services/orders.server.ts` | Sync god-service |
| 1,876 | `app/services/product.server.ts` | Sync god-service |
| 1,587 | `app/services/executive-dashboard.server.ts` | Aggregator overload |
| 1,571 | `app/services/command-center.server.ts` | Aggregator overload |
| 1,201 | `app/components/command-center/CommandCenter.tsx` | Component >300 lines |
| 1,085 | `app/services/onboarding.server.ts` | Phase machine complexity |
| 1,070 | `app/services/job.server.ts` | Queue + lifecycle in one file |
| 1,034 | `app/components/executive/ExecutiveDashboard.tsx` | Component >300 lines |
| 928 | `app/services/worker.server.ts` | All job handlers in one dispatcher |
| 831 | `app/services/gdpr.server.ts` | GDPR + export + redact combined |
| 752 | `app/services/intelligence-workspace.server.ts` | Workspace loader aggregator |
| 674 | `app/services/intelligence-workspace-views.tsx` | View mapping monolith |

**Threshold violations:** 8 services >800 lines (target: split), 2 components >300 lines, 1 route at 605 lines (`app.settings.tsx`).

---

## Repeated Patterns (Consolidation Opportunities)

| Pattern | Occurrences | Recommendation |
|---------|-------------|----------------|
| `resolveStoreContext` + loader boilerplate | 14 intelligence routes | Already uses `createIntelligenceWorkspaceLoader` — good |
| `Promise.all` parallel fetches in workspace loaders | 12+ | Extract shared shell loader |
| Domain `getXxxUiItems()` mapping | prediction, root-cause, experiments | Shared UI mapper interface |
| Engine `$transaction` upsert blocks | 6 engines | Shared upsert helper with audit |
| `jsonArray()` / evidence ID parsing | intelligence-workspace.server.ts | Already centralized — extend usage |

---

## Naming Standard Report

| Area | Convention | Issues |
|------|------------|--------|
| Folders | kebab-case domains (`root-cause`, `merchant-intelligence`) | Consistent |
| Server files | `*.server.ts` | Consistent |
| Routes | `app.<segment>.tsx` flat routes | Consistent |
| Prisma models | PascalCase | 112 models — consistent |
| Job types | snake_case strings in worker | Consistent with enum |
| Mixed terminology | "Executive" vs "COO" vs "Command Center" | Three names for overlapping surfaces |
| Abbreviations | `coo`, `gdpr`, `seo` in paths | Acceptable domain terms |
| Intelligence vs Learning | Both used for overlapping concepts | Document glossary |

---

## Trivial Fixes Applied

None in this audit pass — audit-only per mission scope. Recommended trivial cleanups:

- Remove duplicate `f310-run-worker.ts` copies
- Remove `@deprecated` alias after confirming zero callers
- Remove unused imports in route files flagged by ESLint
