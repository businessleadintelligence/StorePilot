# Prompt Runtime Verification — Phase C.1

**Date:** 2026-07-10  
**Verification methods:** Runtime endpoint, local validation, filesystem inventory, build script review

---

## Production Runtime (Verified via `/health/ready`)

```json
{
  "id": "foundation_prompt_registry",
  "ok": false,
  "reason": "missing_prompts:ExecutiveBriefing,DailyOperatingPlan,RootCauseExplanation,platform.template,product-intelligence,inventory-intelligence,bundle-discovery,store-audit,trend-intelligence,seo-intelligence,pricing-intelligence,growth-intelligence,executive-coo"
}
```

**13 prompts missing at runtime** on Vercel serverless (`process.cwd()` = `/var/task`).

---

## Local Repository (Verified via local validation)

```bash
npx tsx --eval "validateFoundationPromptRegistry()"
→ {"ok":true,"missingPromptIds":[]}
```

**All required prompts exist on disk** in `app/ai/prompts/`.

---

## Required Prompt List (Code SSOT)

From `app/ai/foundation/prompt-validation.server.ts`:

| Prompt ID | File on disk | Prod runtime |
|-----------|--------------|--------------|
| ExecutiveBriefing | ExecutiveBriefing.md | ❌ Missing |
| DailyOperatingPlan | DailyOperatingPlan.md | ❌ Missing |
| RootCauseExplanation | RootCauseExplanation.md | ❌ Missing |
| platform.template | platform.template.md | ❌ Missing |
| product-intelligence | product-intelligence.md | ❌ Missing |
| inventory-intelligence | inventory-intelligence.md | ❌ Missing |
| bundle-discovery | bundle-discovery.md | ❌ Missing |
| store-audit | store-audit.md | ❌ Missing |
| trend-intelligence | trend-intelligence.md | ❌ Missing |
| seo-intelligence | seo-intelligence.md | ❌ Missing |
| pricing-intelligence | pricing-intelligence.md | ❌ Missing |
| growth-intelligence | growth-intelligence.md | ❌ Missing |
| executive-coo | executive-coo.md | ❌ Missing |

---

## User-Requested Prompts NOT in Required List

Searched codebase — **these prompt IDs do not exist** as foundation requirements:

| Prompt ID | Status |
|-----------|--------|
| PredictionExplanation | **Not in codebase** — N/A |
| ExperimentExplanation | **Not in codebase** — N/A |
| ExecutiveSummary | Tool/schema name only — **not a prompt registry ID** |
| DailyPlan | **Not in codebase** — use `DailyOperatingPlan` |

---

## Root Cause Analysis

| Hypothesis | Verdict | Evidence |
|------------|---------|----------|
| Prompts never authored | ❌ False | 13+ `.md` files in repo |
| Build doesn't copy prompts | ⚠️ **Likely** | `copy-vercel-prompts.mjs` copies to `build/server/*/app/ai/prompts` but validator reads `process.cwd()/app/ai/prompts` |
| Wrong runtime path | ⚠️ **Likely** | Vercel cwd `/var/task` — no `app/ai/prompts` at that path |
| Startup doesn't load cache | N/A | File-based loader used |
| Deployment omitting files | ⚠️ **Likely** | Same as bundling |

**Classification:** **Bundling / filesystem / deployment issue** — not missing source prompts.

---

## Build Script (Verified via codebase)

`scripts/copy-vercel-prompts.mjs`:
- Copies `app/ai/prompts` → `build/server/<hash>/app/ai/prompts`
- Does **not** change `validateFoundationPromptRegistry` lookup path

---

## Impact

| Area | Impact |
|------|--------|
| `/health/ready` | Fails — blocks "ready" status |
| AI Foundation jobs at runtime | **Likely fail** when prompt lookup runs |
| AI provider health check | **Passes** (doesn't load prompts) |
| Executive COO | Also gated by missing `AI_PLATFORM_ENABLED` (see ENV doc) |

---

## Issue P-1: Runtime Prompt Path Mismatch

| Field | Value |
|-------|-------|
| Severity | High |
| Location | `prompt-validation.server.ts` + Vercel bundle |
| Root Cause | Validator uses repo path; serverless bundle path differs |
| Evidence | Local ok=true; prod 13 missing |
| Fix | Resolve prompt path for serverless OR embed prompts in bundle at expected cwd |
| Verification | `/health/ready` foundation_prompt_registry ok |
| Owner | Platform |
| Est. time | 4–8 hours |

**Do not create duplicate prompt files** — fix path/bundling only.
