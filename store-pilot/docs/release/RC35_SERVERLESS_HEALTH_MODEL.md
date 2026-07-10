# RC3.5 — Serverless Health Model

**Date:** 2026-07-10  
**Scope:** Operational semantics for Vercel Cron architecture

---

## Design principle

Health endpoints must reflect **whether the system can process work**, not whether a persistent process is running.

Under serverless cron, `worker_instances.activeWorkers === 0` is **expected and healthy**.

---

## Healthy system (serverless)

| Signal | Source | Pass |
|--------|--------|------|
| Cron configured | `CRON_SECRET` set → `cron.queueEnabled: true` | ✓ |
| Queue responsive | `getJobQueueMetrics()` succeeds | ✓ |
| Jobs completing | `queueExtended.throughputLastHour > 0` OR queue empty with no backlog | ✓ |
| Dead letters under threshold | `queue.deadLetter === 0` | ✓ (degraded if > 0) |
| Prompt registry loaded | `/health/ready` → `foundation_prompt_registry` | ✓ |
| Migrations current | `/health/ready` → `migrations` | ✓ |
| AI provider reachable | `/health/monitor` → `ai` check | ✓ (when configured) |
| Database reachable | `/health/monitor` → `database` check | ✓ |

---

## Unhealthy system (serverless)

| Condition | Alert | HTTP |
|-----------|-------|------|
| No cron AND no persistent workers | `no_worker_capacity` | 503 |
| `CRON_SECRET` missing | `cron_secret` / readiness fail | 503 |
| Database unreachable | `database` unhealthy | 503 |
| Prompt registry missing | readiness fail | 503 |
| Migrations missing | readiness fail | 503 |

---

## Degraded (not blocking)

| Condition | Alert | HTTP |
|-----------|-------|------|
| Dead-letter jobs present | `dead_letter_jobs:N` | 200 |
| Oldest queued job > 10 min | `oldest_queued_job_minutes:N` | 200 |
| Expired lock orphans | `orphan_jobs:N` (lock_expired only) | 200 |
| Stale registered workers (hybrid mode) | `stale_workers:N` | 200 |
| AI provider slow/degraded | `ai` degraded | 200 |

---

## Endpoint behavior

### `GET /health`

Liveness only — always 200. No worker check.

### `GET /health/ready`

Startup readiness from `getStartupReadiness()`:

- `cron_secret` — CRON_SECRET configured
- `worker_queue` — cron queue enabled (not persistent worker)
- Shopify env, database, token encryption, migrations, prompts

Does **not** check `activeWorkers`.

### `GET /health/worker`

From `getWorkerInfrastructureHealth()`:

```json
{
  "ok": true,
  "status": "healthy",
  "executionMode": "serverless_cron",
  "cron": { "queueEnabled": true, "cronSecretConfigured": true },
  "workers": { "activeWorkers": 0 },
  "queue": { "queued": 0, "deadLetter": 0 },
  "alerts": []
}
```

**503 only when:** `no_worker_capacity` (no CRON_SECRET and no persistent workers) or other unhealthy queue conditions that block processing.

### `GET /health/monitor`

Aggregates: database, supabase, shopify_api, queue, cron, worker, ai.

Worker check uses same serverless semantics as `/health/worker`.

---

## Removed assumptions

| Old check | New behavior |
|-----------|--------------|
| `activeWorkers > 0` required | Removed — informational only |
| `no_active_workers` → unhealthy | Replaced with `no_worker_capacity` (cron missing + no workers) |
| Cron lock holders flagged as orphans | `cron-worker-*` excluded from `worker_offline` orphan detection |
| `cronFallback` field name | Renamed to `cron` in health payload |

---

## Operational verification commands

```bash
# Worker health (expect executionMode: serverless_cron, activeWorkers: 0)
curl -s https://YOUR_APP/health/worker | jq '{ok, status, executionMode, alerts, cron}'

# Full monitor
curl -s https://YOUR_APP/health/monitor | jq '{ok, checks: [.checks[] | {id, status, ok}]}'

# Cron auth probe (unauthorized — config only)
curl -s https://YOUR_APP/cron/worker | jq '.health'
```

## Cron execution logs

Vercel Dashboard → Logs → filter:

- `path:/cron/worker` — job batch cycles
- `path:/cron/dispatch/` — maintenance crons

Look for `[cron-worker] cron_worker_completed` in function logs.
