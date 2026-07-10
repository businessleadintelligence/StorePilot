# Database Operations Audit

## Current State

Prisma uses `DATABASE_URL`, `DIRECT_URL`, and optional shadow database URL. The app includes a shared Prisma client wrapper, retry helpers, transaction helpers, pool configuration audit, slow query metrics, and many indexes in schema/migrations. The queue is Postgres-backed.

## Strengths

- Pool configuration guidance exists for Vercel serverless and workers.
- Startup readiness checks applied migrations against `_prisma_migrations`.
- Retry helpers cover common transient Prisma errors.
- Slow query and slow transaction metrics exist in process memory.
- Queue tables include indexes for status, availability, priority, store, lock expiry, and dead letter states.
- Unique idempotency keys exist for queue jobs.

## Weaknesses

- No evidence of production query plan review or pg_stat_statements dashboard.
- Metrics are process-local, not durable.
- No partitioning strategy for evidence, graph, snapshots, AI telemetry, job events, or webhook events.
- No vacuum/autovacuum tuning evidence.
- No explicit large-delete strategy for shop/redact at 100k stores.
- No schema-level retention policy for high-growth operational tables.
- No backup restore verification.

## Risk Level

Critical for 100k-store scale. Medium for a limited beta if store count and data volume are capped.

## Scale Estimate

| Stores | Database posture |
|---:|---|
| 100 | Likely manageable with current indexes and pooler settings. |
| 1,000 | Needs query dashboards, retention jobs, and queue SLOs. |
| 10,000 | Needs partitioning/archival for evidence, events, AI, and graph data. |
| 100,000 | Current design requires major data lifecycle, sharding/partitioning, and workload separation work. |

## Recommendations

- Add pg_stat_statements dashboards and slow query alerts.
- Define retention windows per table.
- Partition high-growth tables by time and/or store where appropriate.
- Add batch deletion strategy for GDPR/shop redact and uninstall cleanup.
- Run migration deploy separately from app/worker startup.
- Add restore drill and migration rollback playbook.

## Priority

P0 for restore proof. P1 for query dashboards and retention. P2/P3 for partitioning based on growth.

## Estimated Engineering Effort

2 to 4 weeks for P0/P1; 1 to 3 months for scale architecture.
