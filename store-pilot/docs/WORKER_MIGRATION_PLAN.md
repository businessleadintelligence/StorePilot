# Worker Migration Plan

**Date:** 2026-07-09  
**Objective:** Replace Vercel-Cron-only job processing with continuous worker infrastructure  
**Risk:** Low — additive deployment; cron fallback retained

---

## Phase 0 — Prerequisites (15 min)

- [ ] Confirm production `CRON_SECRET` is set in Vercel
- [ ] Confirm `DATABASE_URL` uses pooler with `connection_limit=1`
- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Verify migration `20260709143000_worker_infrastructure` applied

```bash
cd store-pilot
npx prisma migrate deploy
npx prisma generate
```

---

## Phase 1 — Deploy code (same release as migration)

Deploy updated Vercel app with:

- `vercel.json` worker cron at `*/2 * * * *` (fallback)
- `/health/worker` endpoint
- Enhanced job service (claimed/retrying states)

**No downtime** — existing queued jobs remain valid.

---

## Phase 2 — Deploy continuous worker (30 min)

### Option A — Railway (recommended)

1. Create new Railway service from same repo
2. Set Dockerfile path: `Dockerfile.worker`
3. Configure env vars (mirror Vercel production):
   - `DATABASE_URL`, `DIRECT_URL`
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL`
   - `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`
4. Start command: `npm run worker`
5. Scale: 1 instance initially; increase for throughput

### Option B — Local / manual validation

```bash
npm run worker
```

In another terminal:

```bash
curl https://store-pilot-eta.vercel.app/health/worker
```

Expected: `activeWorkers >= 1`, queue drains.

---

## Phase 3 — Unblock current production store (5 min)

If bootstrap job still queued from prior install:

1. Deploy continuous worker (Phase 2), **or**
2. Manual cron trigger:

```bash
curl -X POST "https://store-pilot-eta.vercel.app/cron/worker" \
  -H "x-cron-secret: $CRON_SECRET"
```

Repeat until onboarding reaches 100% (products → inventory → orders).

Verify:

```sql
SELECT status, attempts FROM sync_jobs WHERE job_type = 'bootstrap_products';
SELECT progress_percent, product_sync_status FROM store_onboarding;
SELECT COUNT(*) FROM products;
```

---

## Phase 4 — Monitoring setup (15 min)

| Check | Endpoint | Alert if |
|-------|----------|----------|
| Worker alive | `GET /health/worker` | `activeWorkers === 0` |
| Queue backlog | `GET /health/worker` | `oldestQueuedJobAgeMs > 600000` |
| Dead letters | `GET /health/worker` | `deadLetter > 0` |
| Orphans | `GET /health/worker` | `orphanJobs.length > 0` |

Integrate with UptimeRobot, Better Stack, or Datadog synthetic checks polling `/health/worker` every 1–5 minutes.

---

## Phase 5 — Cron fallback validation (10 min)

Confirm Vercel cron still works if worker is stopped:

1. Stop Railway worker temporarily
2. Wait 2–4 minutes for Vercel cron
3. Confirm `/health/worker` shows `no_active_workers` but jobs eventually process via cron
4. Restart continuous worker

---

## Rollback plan

| Scenario | Action |
|----------|--------|
| Worker crashes loop | Vercel cron continues processing every 2 min |
| Migration fails | Do not deploy app code; fix migration first |
| Claimed jobs stuck | `releaseStaleJobs` runs each worker cycle; manual POST `/cron/worker` |
| Need full rollback | Redeploy previous app version; worker_instances table harmless if unused |

**Do not rollback migration** unless necessary — `claimed` enum value is additive.

---

## Environment checklist

| Variable | Worker | Vercel |
|----------|--------|--------|
| `DATABASE_URL` | ✅ | ✅ |
| `SHOPIFY_*` | ✅ | ✅ |
| `TOKEN_ENCRYPTION_KEY` | ✅ | ✅ |
| `CRON_SECRET` | ✅ | ✅ |
| `WORKER_POLL_INTERVAL_MS` | Optional | N/A |
| `WORKER_BATCH_SIZE` | Optional | N/A |
| `JOB_LOCK_DURATION_MS` | Optional | Optional |

---

## Success criteria

- [ ] New install completes onboarding within **5 minutes** (not hours)
- [ ] `/health/worker` returns `status: healthy` with `activeWorkers >= 1`
- [ ] Zero jobs stuck in `claimed` > 10 minutes
- [ ] `sync_jobs` dead-letter count = 0 after migration
- [ ] Products/orders populate after OAuth without manual intervention

---

## Timeline estimate

| Phase | Duration |
|-------|----------|
| Phase 0 — Prerequisites | 15 min |
| Phase 1 — Code deploy | 10 min (CI/CD) |
| Phase 2 — Worker deploy | 30 min |
| Phase 3 — Unblock store | 5 min |
| Phase 4 — Monitoring | 15 min |
| Phase 5 — Validation | 10 min |
| **Total** | **~1.5 hours** |

---

## Post-migration

1. Update runbook: primary processing = continuous worker, not cron
2. Optional: remove daily-only cron concern from ops docs
3. Plan AI job types to use same worker (no separate queue needed)
