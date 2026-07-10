# Worker Deployment — Vercel Cron (Production)

**Date:** 2026-07-10 (RC3.5 serverless alignment)  
**Supersedes:** Railway/Docker worker deployment instructions

---

## Production architecture

StorePilot processes background jobs via **Vercel Cron** — no separate worker service.

```
GitHub → Vercel → Vercel Cron (/cron/worker) → Supabase (sync_jobs) → Shopify API
```

---

## Configuration

### vercel.json

All production crons are defined in `vercel.json` (12 schedules). Must match `cron-scheduler.server.ts`.

Primary worker cron:

```json
{ "path": "/cron/worker", "schedule": "*/2 * * * *" }
```

### Environment

| Variable | Required |
|----------|----------|
| `CRON_SECRET` | Yes — Vercel injects as Bearer token on cron invocations |
| `CRON_JOB_BATCH_SIZE` | Optional (default 3, max 10) |
| `DATABASE_URL` | Yes |
| All Shopify vars | Yes |

---

## Verification

### 1. Cron schedules active

Vercel Dashboard → Project → Settings → Cron Jobs

### 2. Cron execution logs

Vercel Dashboard → Logs → filter `path:/cron/worker`

Expected log sequence:
- `[cron-worker] cron_worker_started`
- `[worker] worker_cycle_completed`
- `[cron-worker] cron_worker_completed`

### 3. Worker health endpoint

```bash
curl -s https://YOUR_APP/health/worker | jq '{ok, status, executionMode, alerts}'
```

Pass: `ok: true`, `executionMode: "serverless_cron"`, `activeWorkers: 0` is acceptable.

### 4. Queue monitoring

```bash
curl -s https://YOUR_APP/health/worker | jq '.queueExtended'
```

Monitor: `queueDepth`, `oldestQueuedJobAgeMs`, `throughputLastHour`, `averageExecutionTimeMs`

---

## Local development

For faster iteration without waiting for cron ticks:

```bash
# Manual cron invocation (requires CRON_SECRET)
curl -H "Authorization: Bearer $CRON_SECRET" https://localhost:PORT/cron/worker

# Optional: continuous local worker (not production path)
npm run worker
```

---

## Pass criteria

| Check | Expected |
|-------|----------|
| `/health/worker` | HTTP 200, `executionMode: serverless_cron` |
| `/health/worker` alerts | No `no_worker_capacity` |
| Cron logs | `cron_worker_completed` within 2 min of deploy |
| `sync_jobs` | Jobs transition queued → completed after install |

---

## Legacy (not production)

| Artifact | Status |
|----------|--------|
| `Dockerfile.worker` | Legacy — do not deploy |
| `railway.toml` | Legacy — do not deploy |
| `npm run worker` | Local dev only |
