# Business Stability Score

Proprietary score (0–100) introduced in Sprint 7 alongside Operational Readiness.

## Question answered

> How stable is my business over the next 30 days?

## Components

| Factor | Weight |
|--------|--------|
| Forecast volatility | 18% |
| Inventory risk | 18% |
| Revenue stability | 18% |
| Supplier reliability | 12% |
| Seasonal uncertainty | 10% |
| Pricing stability | 12% |
| Traffic consistency | 12% |

## Computation

Deterministic weighted sum in `app/prediction/confidence/business-stability-scorer.ts`.

Higher score = more stable. Penalties applied when high-confidence predictions exist or inventory/revenue signals are volatile.

## Persistence

`business_stability` table — one row per store, upserted on each prediction run.

## UI

`BusinessStabilityGauge` on the dashboard Predictions & Prevention section.
