# Root Cause Architecture

## End-to-end flow

```mermaid
flowchart TD
    A[Normalized Evidence] --> B[Signal Analysis]
    B --> C[Signal Correlation]
    C --> D[Causal Reasoner]
    D --> E[Business Rules Filter]
    E --> F[Pattern Validation]
    F --> G[Confidence + Impact]
    G --> H[Ranking]
    H --> I[(root_causes)]
    I --> J[Business Context]
    J --> K[Executive COO GPT]
    I --> L[Explanation Payload]
    L --> M[root_cause_reasoning GPT]
```

## Sequence

```mermaid
sequenceDiagram
    participant W as Worker
    participant EDE as Executive Decision Engine
    participant RCE as Root Cause Engine
    participant DB as PostgreSQL
    participant COO as Executive COO

    W->>EDE: executive_decision_generate
    EDE->>DB: decisions, context snapshot
    W->>RCE: root_cause_generate
    RCE->>DB: root causes, chains, timelines
    W->>COO: executive_coo_generate
    COO->>DB: load context + root causes
    COO->>COO: GPT explains structured payload
```

## Database tables

| Table | Purpose |
|-------|---------|
| root_causes | Primary cause records |
| causal_chains | Step chains with evidence |
| causal_timelines | Event timelines |
| signal_correlations | Cross-signal relationships |
| cause_confidences | Confidence audit |
| impact_assessments | Impact estimates |
| causal_graph_edges | Causal graph edges |
| root_cause_history | Change audit |

## AI routing

| Task | Tier | Category |
|------|------|----------|
| Executive explanation | reasoning | `root_cause_reasoning` |
| JSON repair | nano | `json_repair` |

No GPT for: correlation, confidence, timeline, ranking, rules, impact.

## Reuse

Root Cause Engine consumed by:

- Executive COO
- Future Prediction Engine
- Future Experiment Center
- Future Business Simulation
- Future AI Chat
