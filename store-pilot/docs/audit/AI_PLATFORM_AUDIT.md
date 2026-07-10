# AI Platform Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Executive Summary

StorePilot has **three coexisting AI stacks**. Production traffic is split between AI Foundation (2 consumers) and V2 Orchestrator (9+ consumers). The sole OpenAI SDK entry point is correctly isolated to `app/ai/providers/openai/openai-client.ts`.

**Production Score for AI Platform:** 78/100 — strong Foundation design, incomplete adoption.

---

## Stack Inventory

| Stack | Path | Production Usage |
|-------|------|------------------|
| AI Foundation | `app/ai/foundation/` | 2 services |
| V2 Orchestrator | `app/ai/orchestrator/` | 9 intelligence services + onboarding |
| V1 Runner | `app/ai/core/ai-runner.ts` | Tests only |

---

## Foundation Components (Present & Wired)

| Component | Path | Pipeline Wired |
|-----------|------|----------------|
| Provider Router | `foundation/provider-router/router.ts` | Yes |
| Model Router | `foundation/model-router/` | Yes |
| Prompt Registry | `foundation/prompt-registry/` | Yes |
| Circuit Breaker | `foundation/retry/circuit-breaker.ts` | Yes |
| Retry Engine | `foundation/retry/retry-engine.ts` | Yes |
| Cost Manager | `foundation/cost/cost-manager.ts` | Yes (in-memory default) |
| Cache | `foundation/cache/cache-service.ts` | Yes (in-memory) |
| PII Sanitizer | `foundation/utils/pii-sanitizer.ts` | Yes |
| Structured Output | `foundation/structured-output/engine.ts` | Yes |
| Response Validator | `foundation/response-validator/validator.ts` | Yes |

---

## Bypass Violations

Services using `getAIOrchestrator()` (bypass Foundation):

| File |
|------|
| `app/services/bundle-intelligence.server.ts` |
| `app/services/product-intelligence.server.ts` |
| `app/services/inventory-intelligence.server.ts` |
| `app/services/trend-intelligence.server.ts` |
| `app/services/store-audit.server.ts` |
| `app/services/executive-coo.server.ts` |
| `app/services/growth-intelligence.server.ts` |
| `app/services/pricing-intelligence.server.ts` |
| `app/services/seo-intelligence.server.ts` |

Foundation-compliant:

| File |
|------|
| `app/executive/coo/coo-service.ts` |
| `app/root-cause/explanations/explanation-service.ts` |

---

## Critical Gaps

| Gap | Evidence | Risk |
|-----|----------|------|
| Missing prompt files for Foundation IDs | `ExecutiveBriefing`, `DailyOperatingPlan`, `RootCauseExplanation` referenced in coo-service/explanation-service but no matching `.md` files | Runtime `promptNotFound` when AI enabled |
| Prisma cost ledger not wired | `prisma-cost-ledger.ts` exists, not passed to `createAIFoundationClient()` | Budget enforcement uses in-memory $100 default |
| Foundation telemetry defaults null | `pipeline.ts:61` | No persisted Foundation telemetry |
| No `/health/ai-foundation` route | `getFoundationHealthReport()` unused | Ops blind spot |
| Conflicting architecture docs | `AI_PLATFORM_FOUNDATION.md` vs `PLATFORM_V2.md` | Developer confusion |
| V2 lacks circuit breaker | Only Foundation has `CircuitBreaker` | Provider outage cascades on V2 path |
| Executive COO split brain | Onboarding → V2; scheduler → Foundation | Inconsistent COO output |

---

## Cost Optimization Report

| Opportunity | Current | Recommendation | Savings |
|-------------|---------|----------------|---------|
| Unify to Foundation with model routing | V2 uses flat `AI_MODEL` env | Task-category tier routing | 15-30% on mixed workloads |
| Wire Prisma cost ledger | In-memory Foundation budget | Per-merchant budget from `aiMerchantBudget` | Prevents runaway spend |
| Result caching | Split in-memory systems | Unified Prisma cache (V2 pattern) | 20-40% on repeated prompts |
| Gate AI behind readiness | Partial (`AI_PLATFORM_ENABLED`) | Extend to all intelligence services | Eliminates unnecessary calls |
| Deterministic engines already avoid GPT | Prediction/experiment/root-cause | No change needed | Already optimal |

---

## Prompt Versioning

| Layer | Mechanism | Persistence |
|-------|-----------|-------------|
| Foundation | Registry semver + file frontmatter | File-backed `.md` |
| V2 | `ai_prompt_versions` upsert per run | Prisma |

V2 has stronger runtime versioning. Foundation consumers don't upsert to Prisma.

---

## Schema Validation

Both paths share `validateStructuredOutput` from `app/ai/core/ai-output.ts` (Zod). Foundation adds JSON repair engine and business-rule validators.

---

## Recommendations

| Priority | Action | Effort |
|----------|--------|--------|
| 🔴 Critical | Add missing prompt `.md` files or align IDs | 1 day |
| 🔴 Critical | Pick canonical stack; migrate 9 services OR wrap orchestrator over Foundation | 2-3 weeks |
| 🟠 High | Wire `PrismaCostLedgerStore` + `PrismaTelemetryWriter` to Foundation defaults | 2-3 days |
| 🟠 High | Unify Executive COO to Foundation path | 3-5 days |
| 🟡 Medium | Expose `/health/ai-foundation` | 1 day |
| 🟡 Medium | Update architecture docs to single source of truth | 1 day |
