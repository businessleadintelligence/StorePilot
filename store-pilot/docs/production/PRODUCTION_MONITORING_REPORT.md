# Production Monitoring Report — Phase C.1

**Date:** 2026-07-10

---

## In-App Monitoring (Verified)

| Endpoint | Detects | Currently firing? |
|----------|---------|-------------------|
| /health/worker | no_active_workers | ✅ **YES** |
| /health/monitor | worker unhealthy | ✅ **YES** |
| /health/ready | prompt/migration/drift | ✅ **YES** |
| Monitor queue | backlog, dead letters | No (queue empty) |

---

## Missing External Alerts (Not Verified in repo)

| Scenario | Recommended alert |
|----------|-------------------|
| Worker down | Uptime on /health/worker every 5 min |
| Queue backlog | Alert queueDepth > 0 for >10 min |
| Dead-letter jobs | Alert deadLetter > 0 |
| Prompt failures | Alert readiness 503 |
| Webhook failures | Vercel log drain 5xx on /webhooks/* |
| AI failures | Alert AI job error rate |
| DB failures | Supabase connection alert |
| Cron failures | Vercel cron failure notifications |
| Billing failures | Shopify subscription webhook errors |

---

## Logging (Verified via code)

| Component | Log prefix |
|-----------|------------|
| Cron worker | `[cron-worker]` |
| Session cleanup | `[session-cleanup]` |
| Store deactivate | `[store-deactivate]` |
| Onboarding | `[onboarding]` |

**Vercel log access in Phase C.1:** **Not Verified**

---

## Metrics Available in /health/worker

- queue depth, throughputLastHour
- processMetrics (cyclesCompleted, jobsProcessed)
- orphanJobs array
- worker instance list (empty)

---

## Current Alert State

**CRITICAL: `no_active_workers` — production is actively unhealthy.**

No evidence of external notification configured.
