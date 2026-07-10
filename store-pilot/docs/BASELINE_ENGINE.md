# Baseline Engine

Module: `app/experiments/baseline/baseline-engine.ts`

## Captured metrics

| Metric | Source |
|--------|--------|
| Revenue | `merchantBaseline.revenue.recent30DayRevenue` |
| Conversion | `merchantBaseline.revenue.conversionRate` |
| CTR | Derived from SEO evidence gaps |
| Inventory | `merchantBaseline.inventory.totalInventoryValue` |
| Traffic | Revenue / conversion |
| SEO score | 1 − (seo gaps / 20) |
| Refunds | `merchantBaseline.refund.refundRate` |
| AOV | `merchantBaseline.revenue.averageOrderValue` |
| Margin | `merchantBaseline.pricing.averageMargin` |

## Rules

- Pure deterministic — no GPT
- Stored in `experiment_baselines` per experiment
- Used as comparison anchor for shadow simulation and live observation
