# Observability Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Health Endpoints

| Endpoint | File | Checks |
|----------|------|--------|
| `/health` | `app/routes/health.tsx` | Basic liveness |
| `/health/live` | `health.live.tsx` | Liveness probe |
| `/health/ready` | `health.ready.tsx` | Readiness (DB) |
| `/health/monitor` | `health.monitor.tsx` | Extended monitoring |
| `/health/worker` | `health.worker.tsx` | Worker infrastructure via `getWorkerInfrastructureHealth()` |

**Gap:** No `/health/ai-foundation` despite `getFoundationHealthReport()` existing.

---

## Metrics (Implemented)

| Domain | File | Metrics |
|--------|------|---------|
| Database | `packages/database/metrics.ts` | Query duration, connection wait, pool |
| Worker queue | `worker-metrics.server.ts` | Queue depth, throughput, runtime counters |
| Worker health | `worker-health.server.ts` | Active workers, dead letters, orphan alerts |

---

## Metrics (Gaps)

| Domain | Status |
|--------|--------|
| AI Foundation telemetry | Defaults to null — not persisted |
| V2 AI telemetry | Prisma writer — partial |
| Knowledge graph | No dedicated metrics endpoint |
| Learning engine | No dedicated metrics |
| Prediction/experiment engines | No runtime metrics exposed |
| HTTP request latency | No middleware instrumentation |
| Business KPIs | Dashboard-only, not exported |

---

## Tracing

**Status:** No OpenTelemetry or distributed tracing implementation found.

**Recommendation:** Add OTel for request → worker → AI call chains post-launch.

---

## Alerting

Worker health generates alert strings:
- `no_active_workers`
- `dead_letter_jobs:N`
- `orphan_jobs:N`

**Gap:** Alerts are health endpoint responses — no PagerDuty/Slack integration wired.

---

## Worker Monitoring

| Feature | Status |
|---------|--------|
| Worker registry heartbeats | ✅ |
| Queue depth metrics | ✅ |
| Dead letter count | ✅ |
| Cron fallback monitoring | Partial — cron workers not registered |
| Job event audit trail | ✅ JobEvent table |

---

## System Health UI

`app/routes/app.system-health.tsx` — merchant-facing system health (verify wiring to worker/AI health).

---

## Recommendations

| Priority | Action | Effort |
|----------|--------|--------|
| 🟠 High | Expose AI Foundation health endpoint | 1 day |
| 🟠 High | Wire health alerts to Slack/PagerDuty | 2-3 days |
| 🟡 Medium | Add OTel tracing | 1 week |
| 🟡 Medium | Export queue metrics to Prometheus/Datadog | 3-5 days |
| 🟢 Low | Intelligence engine runtime dashboards | 1 week |

---

## Score: 79/100

Worker and DB observability are solid. AI and business engine observability gaps.
