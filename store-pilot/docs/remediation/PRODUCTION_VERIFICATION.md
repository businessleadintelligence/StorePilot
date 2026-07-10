# Production Verification — Phase C.2

## Pre-Deploy Checklist

- [x] All tests pass locally (3033/3033)
- [x] Queue/idempotency fixes merged
- [x] Webhook canonical handler
- [x] Prompt copy script updated
- [x] Cron fallback schedule updated in `vercel.json`
- [ ] Deploy to Vercel
- [ ] Deploy Railway worker
- [ ] Verify health endpoints

## Health Endpoints

| Endpoint | Expected | Current (pre-deploy) |
|----------|----------|----------------------|
| `/health` | 200 ok | 200 |
| `/health/ready` | 200 all checks | 503 (prompts, scope drift) |
| `/health/worker` | 200 activeWorkers≥1 | 503 no_active_workers |
| `/health/monitor` | 200 | degraded |

## E2E Install Trace (to execute post-deploy)

1. Create new Shopify development store
2. Install StorePilot
3. Record timestamps at each stage:

| Stage | Verify |
|-------|--------|
| OAuth | Session created |
| Bootstrap | `advanceOnboarding` → job queued |
| Worker claim | `sync_jobs.status = claimed` |
| Products sync | products count > 0 |
| Knowledge | ingest job completed |
| Graph | graph build completed |
| Learning | bootstrap completed |
| Dashboard | 100%, all cards ready |

### SQL queries

```sql
-- Onboarding
SELECT status, "progressPercent", "productSyncStatus", "currentJobId"
FROM store_onboarding WHERE "storeId" = '<id>';

-- Jobs
SELECT "jobType", status, attempts, "createdAt", "completedAt"
FROM sync_jobs WHERE "storeId" = '<id>' ORDER BY "createdAt";

-- Workers
SELECT * FROM worker_instances WHERE "lastHeartbeatAt" > NOW() - INTERVAL '5 minutes';
```

## Stuck Store Repair

Store `7f1a9df7-d3db-45a1-9a59-a12155f371a1` (storepilot-pe9x0muw):

After deploy + worker active, call `advanceOnboarding({ storeId })` or merchant re-opens app — `repairTerminalPhaseJobs()` should reset cancelled products phase and re-enqueue.

## Evidence Log Template

| Timestamp | Stage | Duration | DB writes | Errors |
|-----------|-------|----------|-----------|--------|
| | | | | |

(Fill during live E2E run)
