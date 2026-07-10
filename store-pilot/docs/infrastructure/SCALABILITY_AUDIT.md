# Scalability Audit

## Current State

StorePilot is architected around serverless web routes, a Postgres-backed queue, continuous workers, Prisma/Postgres, and AI/provider integrations. The application model anticipates evidence, graph relationships, memory, predictions, experiments, and operational metrics.

## Strengths

- Queue provides asynchronous processing boundary.
- Worker batch size and poll interval are configurable.
- Database indexes exist for many operational paths.
- AI model tier routing can reduce cost if consistently used.
- Privacy-first normalized data reduces some storage explosion from raw Shopify data.

## Weaknesses

- Postgres-backed queue may become a hot table at high throughput.
- Evidence, graph, AI telemetry, job events, and snapshots need partitioning/archival before large scale.
- No worker autoscaling policy in repo.
- No capacity model for products, evidence records, graph edges, predictions, and experiments.
- No cache strategy for expensive dashboard/graph views was proven.
- No provider quota model for Shopify/OpenAI/Anthropic/Google/Microsoft.

## Risk Level

Critical for 100k stores; Medium for limited beta.

## Bottlenecks

First bottleneck: database growth and query load on evidence/graph/job tables.

Second bottleneck: external provider quotas and AI cost/rate limits.

Third bottleneck: worker throughput and queue latency under webhook and scheduled job bursts.

## Store Scale Estimate

| Stores | Expected posture |
|---:|---|
| 100 | Current architecture likely works with monitoring. |
| 1,000 | Requires external alerts, retention, and queue SLOs. |
| 10,000 | Requires partitioning, caching, provider quota controls, and worker autoscaling. |
| 50,000 | Requires workload isolation and possibly read replicas/materialized views. |
| 100,000 | Requires mature data lifecycle, sharding/partitioning strategy, dedicated queue/stream consideration, and formal SRE operations. |

## Recommendations

- Build capacity model per store: products, variants, orders, evidence, graph edges, AI runs, jobs, events.
- Add table growth dashboards.
- Partition or archive high-volume tables.
- Consider dedicated queue infrastructure once Postgres queue becomes write-hot.
- Add per-store workload quotas and back pressure.

## Priority

P1 for capacity model. P2 for partitioning. P3 for dedicated queue migration depending on measured load.

## Estimated Engineering Effort

1 to 2 weeks for model/dashboard; 1 to 3 months for scale architecture.
