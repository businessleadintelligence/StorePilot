# Experiment Database

Migration: `20260710030000_experiment_intelligence_platform`

## Tables

| Table | Purpose |
|-------|---------|
| `experiments` | Main experiment records with shadow simulation JSON |
| `experiment_templates` | Deterministic template definitions per store |
| `experiment_opportunities` | Evidence-backed opportunities before planning |
| `experiment_recommendations` | Merchant-facing recommendations |
| `experiment_baselines` | Captured baseline metrics |
| `experiment_variants` | Control + variant definitions |
| `experiment_observations` | Incremental metric observations |
| `experiment_results` | Baseline vs variant comparisons |
| `experiment_winners` | Winner selection outcomes |
| `experiment_history` | Audit trail snapshots |
| `experiment_learning` | Sprint 9 outcome learning events |
| `experiment_confidences` | Confidence breakdowns |

## Enums

- `ExperimentDomain`: pricing, seo, bundles, inventory, merchandising, collections, content, operations
- `ExperimentStatus`: suggested, shadow_simulated, pending_approval, approved, running, completed, rejected, dismissed, cancelled, no_change, tie
- `ExperimentRiskLevel`: low, medium, high
- `ExperimentWinnerOutcome`: winner, loser, no_change, statistical_tie
- `ExperimentSourceType`: quick_win, root_cause, prediction, pattern, evidence
- `ExperimentEventType`: ExperimentStarted, ExperimentCompleted, WinnerSelected, ExperimentRejected, ExperimentCancelled

## Learning readiness

`learning_readiness.experimentReady` — set true when first experiment batch completes.

## Job type

`JobType.experiment_generate`
