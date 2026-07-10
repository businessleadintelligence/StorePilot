# Worker Infrastructure Audit

## Current State

StorePilot has two worker modes: a continuous worker started from `scripts/worker.ts`, and a cron fallback endpoint at `/cron/worker`. The runtime registers worker instances, sends heartbeats, handles SIGINT/SIGTERM, claims batches, and releases stale jobs. Queue claiming uses Postgres row locking with SKIP LOCKED.

## Strengths

- Worker registry records active, draining, stopped, stale, and current-job state.
- Heartbeat interval and stale threshold are configurable.
- Batch size is bounded.
- Signal handlers attempt graceful draining and worker stop marking.
- Orphan/stale job detection exists.
- Queue claim uses visibility timeout and lock expiry.

## Weaknesses

- Production image runs `npx tsx scripts/worker.ts`; this is not a hardened runtime artifact.
- `trackInFlightJob` exists but appears unwired from actual job execution, so current-job observability and drain behavior may be incomplete.
- No Railway autoscaling, restart, memory, CPU, or deploy health policy was found in repo.
- No zero-downtime worker rollout procedure is documented in config.
- No evidence of multi-worker load test with 20 workers.
- Cron fallback and continuous worker can both process the same queue; correctness depends on locking and idempotent handlers.

## Risk Level

High. The queue primitives are solid, but operational worker deployment and observability are not yet production-grade.

## Recommendations

- Compile the worker into a production JS entrypoint and run with `node`.
- Wire `trackInFlightJob` around job execution.
- Add a 20-worker concurrency/load test covering duplicate execution, SIGTERM, crash recovery, stale lock recovery, and dead-letter behavior.
- Add Railway deployment docs: health checks, restart policy, environment parity, rollout sequence, and worker drain.
- Add worker dashboard panels for active workers, stale workers, oldest queued age, throughput, failed jobs, and dead letters.

## Priority

P0 for runtime hardening. P1 for in-flight tracking and 20-worker test. P2 for autoscaling policy.

## Estimated Engineering Effort

1 to 2 weeks.

## Can 20 Workers Process Jobs Safely?

Probably safe for claim uniqueness because SKIP LOCKED and lock ownership exist, but not certified. The missing proof is a 20-worker integration test and handler-by-handler idempotency verification.
