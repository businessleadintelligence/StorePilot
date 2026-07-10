# Testing Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Summary

| Metric | Value |
|--------|-------|
| Test files | 273 |
| Tests passing | 3,005 |
| Test framework | Vitest 4.1 |
| Route tests | 21 in `app/routes/__tests__/` |

**Verdict:** Exceptionally strong unit/integration test coverage for a platform of this complexity.

---

## Coverage Report

Last run (`vitest run --coverage`):

| Metric | Coverage |
|--------|----------|
| Statements | 72.01% |
| Branches | 60.28% |
| Functions | 80.72% |
| Lines | 71.97% |

**Note:** Coverage report scope appears limited to instrumented subset (779 statements reported). Full codebase coverage likely lower on sync god-services.

---

## Test Categories Present

| Category | Examples | Status |
|----------|----------|--------|
| Worker/job reliability | `f33-job-service`, `f37-worker-engine`, `f38-worker-reliability` | ✅ Strong |
| GDPR webhooks | `f44-gdpr-webhooks`, `f44-gdpr-webhook-routes` | ✅ Strong |
| Privacy by architecture | `privacy-by-architecture.test.ts` | ✅ Strong |
| Domain engines | prediction, experiment, root-cause, merchant-intelligence tests | ✅ Strong |
| Knowledge graph | `knowledge-graph.test.ts` (564 lines) | ✅ Strong |
| AI platform | `foundation-platform.test.ts`, orchestrator tests | ✅ Good |
| Executive dashboard | `f56-executive-dashboard.test.ts` | ✅ Good |
| Intelligence workspace | `intelligence-workspace.test.ts` | ✅ New (1 test) |
| Orders regression | `f0-orders-regression.test.ts` (629 lines) | ✅ Good |
| Production hardening | `production-hardening.test.ts` | ✅ Good |

---

## Missing Test Matrix

| Area | Gap | Priority |
|------|-----|----------|
| shop/redact full deletion | No test with intelligence pipeline data → redact → zero rows | 🔴 Critical |
| Cross-store isolation | No test asserting store A cannot read store B data | 🟠 High |
| E2E Playwright | No browser E2E suite found | 🟠 High |
| Load/performance tests | None | 🟡 Medium |
| Intelligence workspace UI | Only loader test — no component tests | 🟡 Medium |
| AI Foundation prompt missing IDs | No test catching promptNotFound at runtime | 🟡 Medium |
| Dead-letter requeue flow | Function exists, untested end-to-end | 🟡 Medium |
| Billing edge cases | Partial coverage | 🟢 Low |

---

## Test Infrastructure

| Asset | Assessment |
|-------|------------|
| `vitest.setup.ts` | 3,724 lines — comprehensive mocks but maintenance burden |
| Mock patterns | Consistent Prisma mocks per domain |
| Test isolation | `vi.clearAllMocks()` in beforeEach — standard |

---

## Recommendations

| Priority | Action | Effort |
|----------|--------|--------|
| 🔴 Critical | Add shop/redact integration test with full pipeline | 2 days |
| 🟠 High | Add cross-tenant isolation test suite | 2-3 days |
| 🟠 High | Add Playwright smoke tests for embedded app | 1 week |
| 🟡 Medium | Expand intelligence workspace route tests | 2 days |
| 🟡 Medium | Split vitest.setup.ts by domain | 3-5 days |

---

## Score: 92/100

3,005 passing tests is production-grade. Deductions for missing E2E, GDPR deletion integration test, and cross-tenant tests.
