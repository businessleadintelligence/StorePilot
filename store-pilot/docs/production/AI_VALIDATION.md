# AI Validation — Phase C

**Date:** 2026-07-10  
**Status:** ⚠️ **PARTIAL** — provider healthy; prompt bundle and COO gate gaps.

---

## AI Foundation

| Component | Location | Status |
|-----------|----------|--------|
| Prompt registry | `app/ai/foundation/prompt-registry` | ✅ Code |
| Prompt validation | `prompt-validation.server.ts` | ❌ Fails on prod readiness |
| Provider router | `app/ai/providers/` | ✅ |
| Model router / tiers | env `AI_TIER_*` | ⚠️ Defaults only in prod |
| Circuit breaker | AI platform | ✅ Code |
| Retry | Provider layer | ✅ Code |
| Caching | AI platform | ✅ Code |
| Cost ledger | AI cost tracking | ✅ Code |
| Budget manager | Billing limits + gates | ✅ Code |

---

## Live Production Probe

**Monitor check (2026-07-10):**

```json
{
  "id": "ai",
  "status": "healthy",
  "message": "OpenAI provider reachable",
  "latencyMs": 527,
  "details": { "provider": "openai", "model": "gpt-4o-mini" }
}
```

**Env present:** `OPENAI_API_KEY`, `AI_PROVIDER`, `AI_MODEL` (Vercel production)

---

## Prompt Registry — Critical Gap

**Readiness failure:**

```
missing_prompts: ExecutiveBriefing, DailyOperatingPlan, RootCauseExplanation,
platform.template, product-intelligence, inventory-intelligence, bundle-discovery,
store-audit, trend-intelligence, seo-intelligence, pricing-intelligence,
growth-intelligence, executive-coo
```

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Location** | Vercel serverless bundle; `scripts/copy-vercel-prompts.mjs` |
| **Root Cause** | Prompt files not found at runtime path `process.cwd()/app/ai/prompts` on Vercel |
| **Evidence** | `/health/ready` 503; build script copies to `build/server/*/app/ai/prompts` |
| **Risk** | AI jobs fail at runtime despite provider health check passing |
| **Recommended Fix** | Verify post-build prompt path; align `validateFoundationPromptRegistry` cwd with bundle layout OR embed prompts |
| **Estimated Fix Time** | 4–8 hours |
| **Owner** | Platform |
| **Verification** | `/health/ready` foundation_prompt_registry ok; COO job completes |

---

## AI_PLATFORM_ENABLED

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Location** | `app/executive/coo/coo-service.ts:152` |
| **Root Cause** | `AI_PLATFORM_ENABLED` not set in Vercel production env |
| **Evidence** | `vercel env ls` — variable absent |
| **Risk** | Executive COO runs deterministic-only path; AI explanations disabled |
| **Recommended Fix** | Set `AI_PLATFORM_ENABLED=true` in production when AI launch intended |
| **Estimated Fix Time** | 15 min |
| **Owner** | DevOps |
| **Verification** | COO output includes AI-generated sections |

---

## Legacy AIOrchestrator Paths

Grep shows `AIOrchestrator` still referenced in:
- `app/services/*-intelligence.server.ts` (product, inventory, SEO, etc.)
- `app/services/executive-coo.server.ts`
- Test files

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Location** | Intelligence services |
| **Root Cause** | Dual AI paths — Foundation + legacy orchestrator coexist |
| **Evidence** | 18+ files reference `ai-orchestrator.server.ts` |
| **Risk** | Inconsistent routing, cost tracking gaps |
| **Recommended Fix** | Document which paths are production; migrate remaining to Foundation (post-launch) |
| **Estimated Fix Time** | Out of Phase C scope |
| **Owner** | AI platform |
| **Verification** | Static audit + runtime prompt ID logs |

**Phase C requirement:** "No AIOrchestrator legacy paths" — ❌ **Not met** in codebase; ⚠️ **Impact unverified** in prod runtime.

---

## GPT Routing & Fallback

| Check | Status |
|-------|--------|
| Tier env vars | ⚠️ Not in Vercel — code defaults |
| Anthropic fallback | ❌ No ANTHROPIC_API_KEY in prod |
| Fallback logic | ✅ Code exists |
| Live routing test | ❌ Not executed |

---

## Runtime Prompt Failures

| Check | Result |
|-------|--------|
| Missing prompt IDs at startup | ❌ **13 missing** on readiness |
| Provider reachable | ✅ |
| No runtime job logs | ❌ Not collected (worker down) |

**Conclusion:** AI **provider layer ready**; **prompt delivery and COO AI gate not production-ready**.
