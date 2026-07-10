# Executive COO

AI reasoning layer for Sprint 5. Communicates like an experienced COO using structured context only.

## Responsibilities

- Generate executive briefing
- Generate daily operating plan
- Explain priorities (via structured sections)
- Never invent facts
- Never query Shopify or compute metrics directly

## Input

Only `BusinessContextBuilder` output (persisted as `business_context_snapshots`).

## Model routing

Uses AI Foundation task categories — no hardcoded model names:

| Output | Task category | Tier |
|--------|---------------|------|
| Executive briefing | `executive_reasoning` | reasoning |
| Daily operating plan | `executive_summary` | standard |
| JSON repair | `json_repair` | nano |

Configure via environment:

```
AI_TIER_REASONING_PROVIDER / AI_TIER_REASONING_MODEL
AI_TIER_STANDARD_PROVIDER / AI_TIER_STANDARD_MODEL
```

## Fallback

When `AI_PLATFORM_ENABLED !== "true"`, deterministic briefing and operating plan are generated from structured context without GPT.

## Persistence

- `executive_briefings` — daily briefing JSON
- `daily_operating_plans` — daily plan JSON

## Readiness

Sets `learning_readiness.executiveCooReady = true` and advances stage to `predictive` when operational readiness ≥ 50 and decisions exist.
