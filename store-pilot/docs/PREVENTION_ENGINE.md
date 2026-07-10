# Prevention Engine

Deterministic action planner paired with the Prediction Engine.

## Purpose

Prediction answers **what will happen**. Prevention answers **what to do before it happens**.

## Example

| Prediction | Prevention |
|------------|------------|
| Stockout in 4 days | Order 180 units today — $6,200 revenue protected |
| SEO declining | Add meta descriptions — 8% traffic loss avoided |
| Refund increase | Review product quality and listing accuracy |

## Templates

Defined in `app/prediction/shared/constants.ts` as `PREVENTION_TEMPLATES`:

- `restock` — inventory stockout
- `fix_metadata` — SEO traffic decline
- `review_product` — refund increase
- `adjust_pricing` — pricing margin risk
- `refresh_collection` — collection inactive
- `review_supplier` — operational supplier delay
- `monitor_trend` — revenue forecast

## Persistence

`prevention_actions` table — one active action per prediction, linked by `predictionId`.

## Module

`app/prediction/prevention/action-planner.ts`
