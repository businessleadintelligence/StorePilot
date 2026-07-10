# Technical Debt Register — StorePilot Phase A

**Date:** 2026-07-10  
Ranked by production launch impact.

---

## 🔴 Critical

| ID | Description | Why It Matters | Risk | Fix | Effort | Files |
|----|-------------|----------------|------|-----|--------|-------|
| TD-01 | Incomplete `shop/redact` deletion | GDPR failure, App Store rejection, FK errors | Legal/Compliance | Delete all store-scoped tables in FK order | 3-5 days | `gdpr.server.ts`, `schema.prisma` |
| TD-02 | Dual AI stacks (Foundation + V2) | Split cost control, no circuit breaker on 9 services | Reliability/Cost | Unify on Foundation | 2-3 weeks | `app/services/*-intelligence.server.ts`, `ai/` |
| TD-03 | Executive COO duplicated | Inconsistent merchant experience | Correctness | Single COO path via Foundation | 3-5 days | `coo-service.ts`, `executive-coo.server.ts` |
| TD-04 | Missing Foundation prompt files | Runtime failure when AI enabled | Outage | Add `.md` prompts or fix IDs | 1 day | `ai/prompts/`, `coo-service.ts` |

---

## 🟠 High Priority

| ID | Description | Why It Matters | Risk | Fix | Effort | Files |
|----|-------------|----------------|------|-----|--------|-------|
| TD-05 | `trackInFlightJob` never wired | Jobs interrupted on worker shutdown | Data loss | Call in worker loop | 1 day | `worker-runtime.server.ts` |
| TD-06 | Fire-and-forget pipeline chaining | Silent intelligence pipeline failures | Silent failures | Await + alert on chain failure | 2 days | `worker.server.ts` |
| TD-07 | Static idempotency keys | Cannot re-run intelligence pipeline | Ops | Versioned keys or status-aware enqueue | 3 days | `job.server.ts`, schedulers |
| TD-08 | Dead-letter jobs no replay UI | Stuck jobs require manual DB intervention | Ops | System health requeue action | 2-3 days | `job.server.ts`, `app.system-health.tsx` |
| TD-09 | God services (orders 2184L, products 1876L) | Unmaintainable, high bug surface | Maintainability | Split by concern | 1-2 weeks | `orders.server.ts`, `product.server.ts` |
| TD-10 | Customer export log-only delivery | GDPR 30-day fulfillment risk | Compliance | Email/webhook to merchant | 2-3 days | `gdpr.server.ts` |
| TD-11 | Orphan worker recovery incomplete | Jobs stuck when worker dies offline | Reliability | Extend recoverOrphanJobs | 2-3 days | `job.server.ts`, `worker-runtime.server.ts` |

---

## 🟡 Medium Priority

| ID | Description | Why It Matters | Fix | Effort | Files |
|----|-------------|----------------|-----|--------|-------|
| TD-12 | Placeholder routes in production | Dead-end UX | Wire or remove | 1-2 days | `app.issues.tsx`, `app.reports.tsx`, `app.additional.tsx` |
| TD-13 | Duplicate worker runners | Ops confusion | Remove f310 copies | 0.5 day | `scripts/f310-run-worker.ts` |
| TD-14 | vitest.setup.ts 3,724 lines | Test maintainability | Split mocks by domain | 3-5 days | `vitest.setup.ts` |
| TD-15 | JSON blob PII drift risk | Privacy | Write-time validation | 3 days | `privacy-by-architecture.ts`, engines |
| TD-16 | No PostgreSQL RLS | Defense in depth | RLS policies or strict test suite | 1 week | `schema.prisma` |
| TD-17 | intelligence-workspace-views monolith | Maintainability | Split by workspace kind | 2-3 days | `intelligence-workspace-views.tsx` |
| TD-18 | Prisma cost ledger not wired to Foundation | Cost control | Wire in client.ts | 1-2 days | `ai/foundation/client.ts` |
| TD-19 | Conflicting AI architecture docs | Developer errors | Consolidate docs | 1 day | `docs/AI_*` |
| TD-20 | Dashboard experiment buttons unwired | UX gap | useFetcher actions | 1-2 days | `SuggestedExperimentCard.tsx` |

---

## 🟢 Low Priority

| ID | Description | Fix | Effort |
|----|-------------|-----|--------|
| TD-21 | Mixed terminology (COO/Executive/Command Center) | Glossary doc | 0.5 day |
| TD-22 | `@deprecated findExpiredLockedJobs` alias | Remove after caller audit | 0.5 day |
| TD-23 | No bundle visualizer in CI | Add vite-plugin-visualizer | 1 day |
| TD-24 | No Storybook for intelligence-ui | Optional dev tooling | 3-5 days |
| TD-25 | `/app/automation` not in nav | Add link if production-ready | 0.5 day |

---

## Hardcoded Values Found

| Value | Location | Recommendation |
|-------|----------|----------------|
| Foundation monthly budget $100 | `cost-manager.ts:62` | Env or Prisma config |
| Default retry 30s / max 15min | `job.server.ts` | Already env-overridable — document |
| Workspace list take limits (50) | `intelligence-workspace.server.ts` | Config constants file |
| Lock duration 5 min default | `job.server.ts` | Document in WORKER_ARCHITECTURE |

---

## Legacy / Deprecated Markers

| Marker | File |
|--------|------|
| `@deprecated findExpiredLockedJobs` | `job.server.ts:397` |
| V1 AI runner | `app/ai/core/ai-runner.ts` |
| Legacy COO route | `app/routes/app.coo.tsx` |
| `SeoRuleStatus "deprecated"` enum value | `seo-knowledge-layer.ts` — domain term, not debt |

**Note:** Minimal TODO/FIXME/HACK comments in codebase — low comment-debt (positive signal).
