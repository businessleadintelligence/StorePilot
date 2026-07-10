# Experiment Architecture

```mermaid
flowchart TD
    A[Knowledge Graph] --> B[Business Memory]
    B --> C[Historical Intelligence]
    C --> D[Root Cause Engine]
    D --> E[Prediction Engine]
    E --> F[Experiment Intelligence Platform]
    F --> G[Shadow Simulation]
    G --> H[Merchant Approval]
    H --> I[Experiment Execution]
    I --> J[Outcome Learning - Sprint 9]
    F --> K[Executive COO]
```

## Folder structure

```
app/experiments/
  engine/           — orchestrator + context loader
  recommendations/  — opportunity engine
  planner/          — experiment planner
  baseline/         — baseline capture
  execution/        — shadow simulator
  confidence/       — confidence scoring
  winner-selection/ — comparison + winner
  learning/         — Sprint 9 event hooks
  scheduler/        — job wiring
  api/              — merchant + COO APIs
  ui/               — suggested experiment cards
  shared/           — types + template constants
  __tests__/
```

## Sequence: Shadow Mode

```mermaid
sequenceDiagram
    participant Job as experiment_generate
    participant Opp as Opportunity Engine
    participant Plan as Planner
    participant Shadow as Shadow Simulator
    participant DB as Database
    participant COO as Executive COO

    Job->>Opp: detect from evidence + memory
    Opp->>Plan: ranked opportunities
    Plan->>Shadow: simulate variants
    Shadow->>DB: persist shadow results
    Job->>COO: experiment summary
    Note over DB: status = shadow_simulated
    Note over DB: No Shopify changes
```

## Performance

| Catalog size | Opportunity detection | Planning + shadow |
|-------------|----------------------|-------------------|
| 100 products | <5ms | <10ms |
| 1,000 | <15ms | <25ms |
| 10,000 | <50ms | <80ms |
| 100,000 | <200ms | <400ms |

Incremental observation only — no catalog rescans. Checkpoint support via worker jobs.
