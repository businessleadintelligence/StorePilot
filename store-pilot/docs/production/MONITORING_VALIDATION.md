# Monitoring Validation — Phase C

**Date:** 2026-07-10

---

## Existing Monitoring Endpoints

| Endpoint | Purpose | Prod result |
|----------|---------|-------------|
| `/health` | Liveness | ✅ 200 |
| `/health/live` | Liveness alias | Not probed (same handler family) |
| `/health/ready` | Startup readiness | ❌ 503 |
| `/health/monitor` | Full monitor report | ❌ 503 (worker unhealthy) |
| `/health/worker` | Worker infra | ❌ 503 |

**Implementation:** `app/services/monitoring.server.ts`, `worker-health.server.ts`, `startup-readiness.server.ts`

---

## Monitor Checks (Live 2026-07-10)

| Check ID | Status | Notes |
|----------|--------|-------|
| database | healthy | PostgreSQL reachable |
| supabase | healthy | DIRECT_URL configured |
| shopify_api | healthy | Keys, URL, scopes valid |
| queue | healthy | Depth 0 |
| cron | healthy | CRON_SECRET set |
| worker | **unhealthy** | no_active_workers |
| ai | healthy | OpenAI probe OK |

---

## Alert Conditions (Code)

From `worker-health.server.ts`:

| Alert | Threshold | Severity | Prod state |
|-------|-----------|----------|------------|
| no_active_workers | activeWorkers === 0 | **unhealthy** | 🔴 **FIRING** |
| stale_workers | heartbeat stale | degraded | OK |
| dead_letter_jobs | count > 0 | degraded | OK (0) |
| queued_jobs_stale | oldest > 10 min | degraded | OK (no queued) |
| orphan_jobs | orphaned claimed jobs | degraded | OK |

---

## Missing External Alerts

| Scenario | In-app detection | External alert (PagerDuty/Slack/email) |
|----------|------------------|------------------------------------------|
| Worker down | ✅ /health/worker | ❌ **Not configured** |
| Queue backlog | ✅ monitor | ❌ |
| Dead-letter jobs | ✅ monitor | ❌ |
| AI failures | ✅ readiness + runtime logs | ❌ |
| Billing failures | ✅ audit logs | ❌ |
| Shopify API failures | ⚠️ job failures | ❌ |
| Webhook failures | ⚠️ webhook event table | ❌ |
| Database failures | ✅ monitor | ❌ |
| Cron failures | ⚠️ no cron execution log | ❌ |

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Location** | Operational monitoring |
| **Root Cause** | Health endpoints exist but no external alerting wired |
| **Evidence** | No alerting config in repo (Vercel/Railway/Supabase integrations not documented) |
| **Risk** | Worker outage undetected until merchant complaint |
| **Recommended Fix** | Uptime monitor on `/health/worker` + `/health/ready`; alert on 503 |
| **Estimated Fix Time** | 2 hours |
| **Owner** | DevOps |
| **Verification** | Synthetic alert fires when worker stopped |

---

## Cron Monitoring Gap

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Location** | Vercel cron |
| **Root Cause** | No logged confirmation that daily cron executed successfully |
| **Evidence** | Worker cron once daily; no cron success metrics in monitor |
| **Risk** | Silent cron failure |
| **Recommended Fix** | Log cron invocations to DB; monitor last success timestamp |
| **Estimated Fix Time** | 4 hours |
| **Owner** | Platform |
| **Verification** | `lastCronWorkerAt` visible in monitor |

---

## Privacy Monitoring

| Check | Schedule | Deployed |
|-------|----------|----------|
| privacy-pii-scan | daily 1 AM | ❌ Not in vercel.json |

---

## Recommended Monitoring Stack (Pre-Launch)

1. **UptimeRobot / Better Stack** — `/health/worker` every 5 min
2. **Vercel log drain** — 5xx on `/webhooks/*`
3. **Supabase metrics** — connection count alert
4. **Shopify Partner Dashboard** — webhook delivery failure alert (manual weekly review until automated)

**Conclusion:** **Detection exists in-app**; **notification layer missing**; **critical alert currently firing** (no workers).
