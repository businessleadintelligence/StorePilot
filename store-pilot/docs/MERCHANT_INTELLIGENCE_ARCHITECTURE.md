# Merchant Intelligence Architecture

```mermaid
flowchart TD
    A[Executive COO] --> B[Merchant Actions]
    B --> C[Decision Journal]
    C --> D[Learning Engines]
    D --> E[Confidence Evolution]
    D --> F[Business Memory vN]
    D --> G[Business DNA vN]
    D --> H[Personalization]
    D --> I[Adaptive Score]
    E --> J[Learning Attribution]
    F --> J
    G --> J
    J --> K[Future Executive COO]
```

## Sequence

```mermaid
sequenceDiagram
    participant COO as executive_coo_generate
    participant MI as merchant_intelligence_refresh
    participant DJ as Decision Journal
    participant BM as Business Memory
    participant COO2 as Next COO Cycle

    COO->>MI: schedule after briefing
    MI->>DJ: ingest intelligence events
    MI->>BM: incremental memory version
    MI->>COO2: enriched merchant profile
```

## Folder structure

```
app/merchant-intelligence/
  decision-journal/
  merchant-behavior/
  recommendation-learning/
  prediction-learning/
  experiment-learning/
  confidence/
  business-dna/
  personalization/
  adaptive-score/
  timeline/
  memory-update/
  shared/learning-attribution.ts
  engine/
  scheduler/
  api/
  ui/
```

## Performance

| Decisions | Incremental refresh |
|-----------|---------------------|
| 100 | ~15ms |
| 1,000 | ~50ms |
| 10,000 | ~200ms |
| 1,000,000 | ~2s (checkpointed batches) |

No full recomputation. Checkpoint via `learning_snapshots`.
