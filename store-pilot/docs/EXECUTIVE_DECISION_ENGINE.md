# Executive Decision Engine

Sprint 5 deterministic brain. No GPT. Fully auditable structured decisions.

## Pipeline

```
Knowledge Graph → Business Memory → Quick Wins
  → Executive Decision Engine
  → Business Context Builder
  → Executive COO (AI reasoning only)
  → Briefing / Operating Plan / Operations Queue
```

## Inputs

- Quick wins (Sprint 4C)
- Pattern seeds (Sprint 4B)
- Merchant baselines
- Business DNA
- Historical memory
- Confidence seeds
- Learning priorities
- Graph statistics

## Outputs

- `executive_decisions` — structured decision records
- `decision_tasks` — operations queue tasks
- `decision_scores` — rank audit trail
- `decision_history` — change snapshots
- `operational_readiness` — 0–100 readiness score
- `business_context_snapshots` — GPT-safe context payload

## Job chain

```
quick_wins_generate
  → executive_decision_generate
    → executive_coo_generate
```

## Module layout

```
app/executive/
  decision-engine/   Builder, scoring, ranking, rules
  decision-context/  Loads graph/memory/quick-win inputs
  business-context/  Builds reusable AI context
  executive-score/   Operational Readiness
  operations-queue/  Decision → task conversion
  prompt-builder/    Compact COO prompt assembly
  coo/               AI reasoning layer (Foundation routing)
  scheduler/         Worker jobs
  api/               Read APIs
  ui/                Dashboard cards
```

## Design rules

- Decision engine never calls GPT
- Every decision traces to evidence IDs or business memory IDs
- COO consumes only `BusinessContextSnapshot` JSON
- No Shopify direct queries in COO layer
