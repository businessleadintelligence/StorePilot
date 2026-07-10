# Prediction Engine

Deterministic forecasting engine for StorePilot Sprint 7.

## Pipeline position

```
Knowledge Graph → Business Memory → Historical Intelligence → Root Cause → Prediction → Prevention → Executive COO
```

## Inputs

- Evidence groups from the knowledge graph
- Pattern seeds and merchant baselines (business memory)
- Active root causes and causal timelines
- Quick wins and graph statistics

## Outputs

Seven forecast types:

| Type | Example |
|------|---------|
| `inventory_stockout` | Stockout in 4 days |
| `revenue_forecast` | Likely -8% next week |
| `seo_traffic_decline` | Expected decline 12% |
| `pricing_margin_risk` | Margin below target in 12 days |
| `refund_increase` | Refund trend expected increase |
| `collection_inactive` | Collection(s) at risk |
| `operational_supplier_delay` | Supply chain revenue impact |

## Rules

- **No GPT** for forecast calculations
- Every prediction includes evidence IDs, root cause IDs, timeline IDs, and confidence breakdown
- Idempotent upsert by `storeId + predictionKey` with soft-replace (`active: false`)

## Job

`JobType.prediction_generate` — scheduled after `root_cause_generate`, before `executive_coo_generate`.

## Module

`app/prediction/engine/prediction-engine.ts`
