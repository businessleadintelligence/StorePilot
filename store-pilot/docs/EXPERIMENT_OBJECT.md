# Experiment Object

## Suggested experiment schema

```json
{
  "experimentId": "uuid",
  "experimentType": "pricing",
  "title": "Increase Protein Powder price by 5%",
  "businessProblem": "Low elasticity detected",
  "proposedChange": "Increase price by 5%",
  "expectedRevenueImpact": 2400,
  "expectedProfitImpact": 840,
  "confidence": 0.91,
  "estimatedDuration": 14,
  "merchantEffort": 2,
  "businessRisk": "low",
  "baselineMetrics": {
    "revenue": 12000,
    "conversion": 0.028,
    "ctr": 0.035,
    "aov": 999,
    "margin": 0.38
  },
  "successMetrics": {
    "primaryMetric": "revenue",
    "targetImprovementPct": 5,
    "secondaryMetrics": ["margin", "conversion"]
  },
  "evidenceIds": ["e1", "e7"],
  "graphNodeIds": [],
  "memoryIds": ["p1"],
  "predictionIds": ["forecast:pricing_margin"],
  "rootCauseIds": ["rc1"],
  "recommendationSource": "prediction",
  "status": "shadow_simulated"
}
```

## GPT receives (explanation only)

```json
{
  "experiment": {},
  "baseline": {},
  "winner": {},
  "confidence": {},
  "expectedImpact": {}
}
```

## Learning events (Sprint 9)

- `ExperimentStarted`
- `ExperimentCompleted`
- `WinnerSelected`
- `ExperimentRejected`
- `ExperimentCancelled`
