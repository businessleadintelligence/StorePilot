# Queue Audit

## Current State

StorePilot uses `SyncJob`, `WorkerInstance`, and `JobEvent` as a Postgres-backed queue. Job states are queued, claimed, running, retrying, completed, failed, dead_letter, and cancelled. Job types include onboarding, bootstrap, orders, connector sync, metrics, recommendations, executive brief, founder maintenance, knowledge ingestion, knowledge graph, learning, historical intelligence, quick wins, executive decisions, Executive COO, root cause, prediction, experiment, and merchant intelligence.

## Strengths

- SKIP LOCKED prevents multiple workers from claiming the same unlocked row.
- Lock expiry and stale job recovery exist.
- Retry state and dead-letter state exist.
- Priority exists.
- Idempotency keys are supported.
- Job events provide an audit trail.
- Queue metrics expose counts by status.

## Weaknesses

- Fairness and starvation protections are not proven for low-priority jobs.
- Replay safety is not documented per JobType.
- No checkpoint contract was found for large jobs such as historical orders, graph build, or learning bootstrap.
- No queue size retention policy was found for completed jobs and job events at large scale.
- Back pressure is not globally coordinated across merchants or providers.
- Poison job triage is manual unless external alerting is added.

## Risk Level

Medium-High. Queue primitives are credible, but large-scale operations need per-job idempotency, replay, checkpoint, and retention certification.

## Job Replay Assessment

| Job family | Replay risk |
|---|---|
| Bootstrap and sync jobs | Medium; must be idempotent by store/entity cursor. |
| Orders jobs | Medium; privacy and financial aggregates require careful duplicate handling. |
| Knowledge graph jobs | High; graph writes need deterministic IDs and checkpointing. |
| Learning/prediction/experiment jobs | High; generated artifacts need versioning and idempotency keys. |
| Executive/merchant intelligence jobs | Medium; should be idempotent per store/date/window. |
| Maintenance jobs | Low-Medium if they operate with bounded batches. |

## Recommendations

- Create a JobType certification matrix: idempotency, replay, checkpoint, timeout, max payload, owner, and dead-letter runbook.
- Add oldest job age and per-type backlog alerts.
- Add job payload size limits.
- Add completed job and JobEvent retention policy.
- Add fair scheduling or per-store quotas to prevent noisy merchants from starving others.

## Priority

P1.

## Estimated Engineering Effort

2 to 4 weeks.
