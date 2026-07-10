# Experiment Engine

Deterministic orchestrator at `app/experiments/engine/experiment-engine.ts`.

## Flow

1. Load context (evidence, patterns, baselines, quick wins, root causes, predictions)
2. Detect opportunities — every opportunity requires evidence IDs or memory IDs
3. Plan experiments from template definitions
4. Run shadow simulation for each experiment
5. Compute confidence breakdown
6. Select shadow winner from simulated comparisons
7. Persist all tables in single transaction
8. Emit learning events (`ExperimentStarted`, `ExperimentCompleted`)
9. Advance `learningReadiness.experimentReady`

## Exports

- `runExperimentEngine(storeId)` — full pipeline
- `runExperimentPlanner` — alias for planner-only re-runs

## Never calls

- Shopify API
- GPT / AI Foundation
