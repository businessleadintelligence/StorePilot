# Decision Journal

Central historical record at `app/merchant-intelligence/decision-journal/`.

## Flow

```
Decision → Merchant Action → Business Result → Confidence Update → Business Memory Update
```

## Stored fields

Decision ID, type, recommendation, evidence IDs, graph node IDs, memory IDs, merchant action, business context, outcome, revenue/profit impact, confidence before/after, related root cause/prediction/experiment IDs.

## Sources ingested

- Experiment learning events
- Executive decisions
- Predictions
- Root causes

Every future intelligence engine consumes the Decision Journal.
