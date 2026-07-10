# Prediction Architecture

## Folder structure

```
app/prediction/
  engine/           — orchestrator + context loader
  forecasting/      — forecast generator
  trend-analysis/   — signal extraction
  confidence/       — business stability scorer
  risk/             — risk assessor
  prevention/       — action planner
  explanations/     — explainable payloads (no GPT)
  scheduler/        — job wiring
  api/              — data access
  ui/               — dashboard cards
  shared/           — types + constants
  __tests__/        — deterministic tests
```

## Database tables

- `predictions`
- `prediction_history`
- `prediction_confidences`
- `forecast_models`
- `forecast_snapshots`
- `prevention_actions`
- `risk_assessments`
- `forecast_accuracy`
- `business_stability`

## Explainable prediction object

```json
{
  "predictionId": "...",
  "predictionType": "inventory_stockout",
  "confidence": 0.96,
  "forecastWindow": "days_4",
  "predictedOutcome": "Stockout in 4 days",
  "contributingSignals": [],
  "historicalSupport": {},
  "evidenceIds": [],
  "graphNodeIds": [],
  "timelineIds": [],
  "preventionActions": [],
  "expectedBusinessImpact": 6200
}
```

## Cost routing

| Task | Engine |
|------|--------|
| Forecast calculations | Deterministic |
| Trend detection | Deterministic |
| Risk scoring | Deterministic |
| Prevention planning | Deterministic |
| Confidence | Deterministic |
| Executive explanation | GPT-5 |
| Merchant Q&A | GPT-5 |

Only 5–10% of requests require GPT.
