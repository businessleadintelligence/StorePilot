# Root Cause Engine

Sprint 6 cross-system causal intelligence platform. Deterministic reasoning with GPT-only explanations.

## Pipeline

```
executive_decision_generate
  → root_cause_generate
    → executive_coo_generate
```

## Module layout

```
app/root-cause/
  engine/              Main orchestration
  signal-analysis/     Cross-system signal detection
  correlation/         Deterministic signal correlations
  rules/               Impossible cause rejection
  causal-chain/        Chain builder
  causal-graph/        Graph edge materialization
  graph-traversal/     Upstream/downstream traversal
  timeline/            Business timeline builder
  confidence/          Deterministic confidence scoring
  ranking/             Cause ranking
  impact/              Revenue/profit/operational impact
  reasoning/           Causal reasoner
  pattern-validation/  Historical pattern validation
  evidence/            Evidence loader
  explanations/        GPT-safe explanation payloads
  scheduler/           Worker jobs
  api/                 Read APIs
  ui/                  Dashboard cards
```

## Design rules

- GPT never discovers causes
- Every cause traces to evidence IDs
- Confidence is always deterministic
- Only normalized evidence consumed (no connector API calls)

See also: `ROOT_CAUSE_ARCHITECTURE.md`, `CAUSAL_REASONING.md`
