# Experiment Planner

Module: `app/experiments/planner/experiment-planner.ts`

## Responsibilities

- Choose experiment type from opportunity template key
- Estimate duration (7–30 days by domain)
- Estimate confidence from source layer
- Estimate revenue and profit impact
- Estimate merchant effort (1–3 scale)
- Estimate business risk (low / medium / high)
- Choose baseline metrics from merchant baselines
- Choose winner metrics (primary + secondary)

## Template selection

Matches opportunity `templateKey` or falls back to domain + source type from `EXPERIMENT_TEMPLATE_DEFINITIONS`.

## Limits

`MAX_EXPERIMENTS_PER_RUN = 12` — top-ranked by composite score.

## Rank score

```
confidence × 35 + impact/100 × 35 + effort bonus + risk bonus
```
