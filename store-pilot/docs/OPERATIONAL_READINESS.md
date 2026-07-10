# Operational Readiness

StorePilot proprietary score measuring execution readiness — not health score, performance score, or business score.

## Output

0–100 composite score with dimensional breakdown.

## Dimensions

| Dimension | Weight | Source |
|-----------|--------|--------|
| Inventory | 15% | Confidence seed |
| Pricing | 12% | Confidence seed |
| SEO | 10% | Confidence seed |
| Collections | 8% | Confidence seed |
| Automation | 8% | Graph + memory signals |
| Operational risks | 12% | Inverse of risk quick wins |
| Execution capacity | 10% | Open task estimate |
| Knowledge confidence | 12% | Learning readiness |
| Historical stability | 8% | Growth/decline patterns |
| Prediction readiness | 5% | DNA + patterns + graph |

## Persistence

`operational_readiness` — one row per store, updated on each decision engine run.

## UI

`OperationalReadinessGauge` on dashboard.

## Executive COO gate

COO marked ready when score ≥ 50 and at least one decision exists.
