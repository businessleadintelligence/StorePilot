# Experiment Intelligence Platform

StorePilot Sprint 8 — the optimization engine.

## Mission

Transform operational insights from every intelligence layer into measurable business improvements. This is **not** A/B testing — it is deterministic experiment intelligence with **Shadow Mode** previews.

## Pipeline

```
Knowledge Graph → Business Memory → Historical Intelligence → Root Cause → Prediction → Experiment Intelligence → Executive COO
```

Outcome Learning (Sprint 9) consumes experiment events after COO.

## Shadow Mode

Before merchant approval, every experiment runs in **shadow mode**:

- Simulates expected impact using historical evidence and Business Memory
- Produces confidence score and projected outcome
- **No Shopify changes** — merchant sees preview only
- Merchant approves → experiment moves to `approved` status

## Supported domains

| Domain | Templates |
|--------|-----------|
| Pricing | Price increase, margin optimization |
| SEO | Meta description, product title |
| Inventory | Reorder threshold, restock timing |
| Bundles | Cross-sell bundle |
| Collections | Merge orphan collections |
| Merchandising | Featured products |
| Content | Description refresh |
| Operations | Duplicate cleanup |

## Critical rules

- **Never GPT** for design, execution, evaluation, or scoring
- Every experiment originates from evidence (Quick Wins, Root Cause, Prediction, Pattern)
- No direct Shopify communication — normalized evidence only
- No customer PII stored
- AI (GPT-5) explains structured experiment payloads only via AI Foundation

## Job

`JobType.experiment_generate` — scheduled after `prediction_generate`, before `executive_coo_generate`.

## Module

`app/experiments/engine/experiment-engine.ts`
