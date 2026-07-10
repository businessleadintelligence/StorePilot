# Adaptive Score

Module: `app/merchant-intelligence/adaptive-score/adaptive-scorer.ts`

## Adaptive Intelligence (0–100)

| Component | Weight area |
|-----------|-------------|
| Merchant participation | Journal entries |
| Journal coverage | Processed entries |
| Experiment completion | Approved/completed |
| Recommendation acceptance | Accepted actions |
| Prediction accuracy | Confidence rollup |
| Confidence quality | Business stability |
| Memory coverage | Version + patterns |
| Learning freshness | Checkpoint age |
| DNA maturity | Version number |
| Merchant feedback | Accepted decisions |
| COO improvement | Decision count |

Stored in `adaptive_score` table. Displayed via `AdaptiveScoreCard` on dashboard.
