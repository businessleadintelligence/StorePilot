# Observability Audit

## Current State

The app has health endpoints, worker infrastructure health, queue health, startup readiness, database pool audit, slow query metrics, AI provider health checks, and log redaction utilities. Metrics are mostly endpoint-returned or process-local.

## Strengths

- `/health`, readiness, monitoring, and worker health surfaces exist.
- Worker health emits active/stale worker, dead-letter, oldest queued age, and orphan alerts.
- Database slow query and slow transaction tracking exists.
- AI health check has timeout behavior.
- Startup readiness surfaces missing configuration and migrations.

## Weaknesses

- No external metrics backend evidence.
- No tracing system evidence.
- No dashboard definitions in repo.
- No SLO definitions for availability, queue latency, AI latency, webhook success, or cron freshness.
- No persistent metrics for serverless instances.
- No memory/CPU monitoring integration for Railway worker.

## Risk Level

High. Incidents can be detected manually through endpoints, but production needs durable telemetry and alerting.

## Recommendations

- Add Datadog/Grafana/Better Stack/Axiom/Sentry or equivalent.
- Define SLOs: app availability, p95 dashboard latency, queue oldest age, worker heartbeat freshness, webhook success rate, cron freshness, DB error rate, AI provider error rate.
- Export metrics from health endpoints to dashboards.
- Add distributed tracing with correlation IDs across web request, cron, job, Shopify request, and AI request.

## Priority

P1.

## Estimated Engineering Effort

1 to 3 weeks.
