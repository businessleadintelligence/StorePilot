# Disaster Recovery Audit

## Current State

Disaster recovery is mostly implicit. There are health checks, startup readiness, queue recovery primitives, and provider fallback ideas, but no complete DR automation or tested restore procedure in repo.

## Strengths

- Workers can release stale jobs after crashes.
- Queue retry/dead-letter behavior exists.
- AI can degrade by tier and providers can be configured.
- Startup readiness can catch missing configuration/migrations.

## Weaknesses

- No tested RTO/RPO.
- No database restore drill.
- No external alerting.
- No documented provider outage playbooks beyond this generated report.
- No emergency read-only mode implementation evidence.
- No queue corruption recovery procedure.

## Risk Level

Critical.

## Scenario Matrix

| Scenario | Detection | Impact | Recovery | Automation | Target RTO | Target RPO |
|---|---|---|---|---|---:|---:|
| Vercel fails | External uptime check needed | App unavailable | Rollback or provider wait | Missing | 1h | 0 |
| Railway fails | Worker heartbeat alert needed | Queue backlog | Restart/rollback worker | Partial | 30m | 0 |
| Database fails | DB health alert needed | App and worker degraded | Supabase restore/failover | Missing | 4h | 24h or PITR |
| OpenAI fails | AI health/error alert | AI features degraded | Route to Anthropic or deterministic fallback | Partial | 1h | 0 |
| Anthropic fails | AI health/error alert | Tier/provider degraded | Route to OpenAI | Partial | 1h | 0 |
| Shopify fails | API error spike | Sync/webhooks delayed | Backoff and retry | Partial | Provider-dependent | 0 |
| Google fails | Connector error spike | Connector stale | Retry later | Partial | 4h | 0 |
| Worker dies | Heartbeat alert | Queue backlog | Restart/redeploy | Partial | 30m | 0 |
| Cron stops | Cron heartbeat needed | Maintenance missed | Manual replay | Missing | 1h | 0 |
| Migration fails | Deploy alert needed | Deploy blocked/partial | Rollback or hotfix | Missing | 1h | backup |
| Queue corrupts | Queue anomaly alert | Job loss/duplication | Pause workers, restore/replay | Missing | 4h | backup |

## Recommendations

- Define formal RTO/RPO by service tier.
- Add DR drills quarterly.
- Add manual and automated recovery steps for each scenario.
- Add provider failover switches.
- Add emergency read-only mode.

## Priority

P0.

## Estimated Engineering Effort

2 to 4 weeks for initial DR readiness; ongoing quarterly drills.
