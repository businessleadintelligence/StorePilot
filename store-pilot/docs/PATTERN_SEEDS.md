# Pattern Seeds

Deterministic pattern detection from historical aggregation — no AI reasoning.

## Pattern Types

| Type | Detection Rule |
|------|----------------|
| `weekend_sales_lift` | Weekend avg orders > weekday avg × 1.15 |
| `high_refund_rate` | Refund ratio ≥ 3% |
| `inventory_pressure` | ≥ 3 low-stock or out-of-stock evidence signals |
| `seasonal_candidate` | SeasonalCandidate evidence facts present |
| `pricing_volatility` | ≥ 2 PriceChanged evidence facts |
| `category_concentration` | Top product ≥ 15% of catalog |
| `order_growth` | 30-day revenue change ≥ ±10% |
| `vendor_concentration` | Reserved for future vendor data |

## Seed Structure

```typescript
{
  patternType: "weekend_sales_lift",
  semanticLabel: "weekend_order_lift",
  confidence: 0.87,
  observationCount: 175,
  evidenceIds: [],
  patternJson: {
    weekendOrders: 175,
    weekdayAverage: 55,
    liftPercent: 59
  }
}
```

## Confidence

Confidence is computed from observation strength — order counts, evidence counts, ratio magnitudes. Capped at 0.98.

## Storage

`pattern_seeds` table — unique on `(storeId, patternType, semanticLabel)`.

Upserted idempotently on each historical intelligence run.

## Future: Pattern Discovery Engine (Sprint 5)

Pattern Seeds are **seeds** — preliminary deterministic patterns. Sprint 5 Pattern Discovery Engine will expand these into full operational patterns with time-series validation.
