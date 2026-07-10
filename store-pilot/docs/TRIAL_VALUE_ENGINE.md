# Trial Value Engine

Sprint 4C accelerates trial value by surfacing deterministic quick wins within the first hour of onboarding.

## Goal

Merchants on the 3-day trial should see immediate, actionable intelligence without waiting for AI agents or pattern discovery.

Example dashboard output:

```
We already found
✓ 14 products missing SEO
✓ 6 inventory risks
✓ 4 pricing opportunities
✓ 2 bundle candidates

Estimated revenue opportunity: $2,140/month
```

## Value chain

```
Shopify data
  → Evidence facts (Sprint 2)
  → Knowledge graph (Sprint 3)
  → Historical memory (Sprint 4B)
  → Quick wins (Sprint 4C)
  → Dashboard card
```

## Trial timing

| Phase | Stage | Merchant sees |
|-------|-------|---------------|
| afterAuth | bootstrap | Learning bootstrap card, import progress |
| graph build | learning | Domain confidence rising |
| historical import | learning | Historical memory synthesized |
| quick wins | operational | Quick wins card with revenue estimate |

Learning readiness advances to `operational` when quick wins are generated.

## Revenue opportunity aggregation

Store-level monthly opportunity is the sum of all ranked win revenue estimates:

```typescript
estimatedRevenueOpportunity = sum(wins.map(w => w.revenueOpportunity))
```

This is persisted in `quick_win_summary` and displayed on the dashboard.

## What quick wins are not

- Not GPT-generated recommendations
- Not probabilistic predictions
- Not agent actions

They are evidence-backed findings with traceable source facts, designed to prove StorePilot value during trial.

## Regeneration

Quick wins regenerate when `quick_wins_generate` runs (after each historical intelligence cycle). Previous wins are deactivated; current wins are upserted by `winType`.

## Future integration

Quick wins feed:

- Executive COO brief (Sprint 5+)
- Recommendation engine prioritization
- Agent task queues (evidence IDs as starting context)

All downstream consumers should read from `quick_wins` and `quick_win_summary`, not re-query Shopify directly.
