# StorePilot — Monitoring Setup

**Sprint:** 6 — Monitoring  
**Date:** 2026-07-09  
**Service:** `store-pilot`

---

## Executive summary

StorePilot exposes **public HTTP health endpoints** for load balancers, uptime monitors, and on-call runbooks. Checks are read-only and return JSON with `Cache-Control: no-store`.

| Endpoint | Purpose | HTTP when healthy |
|----------|---------|-------------------|
| `GET /health` | Liveness (default) | `200` |
| `GET /health/live` | Liveness (explicit) | `200` |
| `GET /health/ready` | Readiness (startup config) | `200` |
| `GET /health?ready=1` | Readiness (legacy alias) | `200` |
| `GET /health/monitor` | Full subsystem monitoring | `200` |
| `GET /health?monitor=1` | Full monitoring (legacy alias) | `200` |
| `GET /cron/worker` | Cron + worker queue config | `200` if queue enabled |

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │           HTTP Endpoints            │
                    ├─────────────┬───────────┬───────────┤
                    │  /health/*  │  /cron/   │  Vercel   │
                    │  (public)   │  worker   │  monitor  │
                    └──────┬──────┴─────┬─────┴─────┬─────┘
                           │            │           │
                    monitoring.server.ts │     External ping
                           │            │
         ┌─────────────────┼────────────┼─────────────────┐
         │                 │            │                 │
    Liveness         Readiness      Cron health      Queue metrics
    (no deps)    startup-readiness  cron-worker      job.server
         │                 │            │                 │
         └────────┬────────┴────────────┴────────┬────────┘
                  │                              │
           Database / Supabase              AI provider
           (Prisma SELECT 1)               (optional probe)
                  │
           Shopify API config
           (env + scopes validation)
```

**Implementation:** `app/services/monitoring.server.ts`  
**Routes:** `app/routes/health*.tsx`

---

## Endpoint reference

### Liveness — `GET /health` or `GET /health/live`

Confirms the Node process is running. **No database or external calls.**

```bash
curl -s https://store-pilot-eta.vercel.app/health
```

```json
{
  "ok": true,
  "service": "store-pilot",
  "mode": "liveness",
  "timestamp": "2026-07-09T07:00:00.000Z"
}
```

**Use for:** Vercel/deployment keep-alive, process-up probes, fastest synthetic check.

---

### Readiness — `GET /health/ready` or `GET /health?ready=1`

Validates **startup configuration** before accepting production traffic. Delegates to `getStartupReadiness()`.

```bash
curl -s -o /dev/null -w "%{http_code}" https://store-pilot-eta.vercel.app/health/ready
```

**Checks:**

| ID | Validates |
|----|-----------|
| `cron_secret` | `CRON_SECRET` set |
| `worker_queue` | Worker queue enabled |
| `shopify_api_secret` | `SHOPIFY_API_SECRET` set |
| `shopify_scopes` | Required scopes present, prohibited absent |
| `shopify_api_key` | `SHOPIFY_API_KEY` set |
| `database_url` | `DATABASE_URL` set |
| `token_encryption_key` | `TOKEN_ENCRYPTION_KEY` set |
| `migrations` | All Prisma migrations applied |
| `webhook_registration_config` | `SHOPIFY_APP_URL` + secret configured |

Returns `503` when any check fails.

---

### Full monitoring — `GET /health/monitor` or `GET /health?monitor=1`

Runs **subsystem health probes** and returns an aggregate report.

```bash
curl -s https://store-pilot-eta.vercel.app/health/monitor | jq .
```

```json
{
  "ok": true,
  "service": "store-pilot",
  "mode": "monitor",
  "timestamp": "2026-07-09T07:00:00.000Z",
  "checks": [
    { "id": "database", "status": "healthy", "ok": true, "latencyMs": 42 },
    { "id": "supabase", "status": "healthy", "ok": true },
    { "id": "shopify_api", "status": "healthy", "ok": true },
    { "id": "queue", "status": "healthy", "ok": true, "details": { "queued": 0, "running": 1, "deadLetter": 0, "retrying": 0 } },
    { "id": "cron", "status": "healthy", "ok": true },
    { "id": "worker", "status": "healthy", "ok": true },
    { "id": "ai", "status": "disabled", "ok": true, "message": "AI platform not configured" }
  ]
}
```

Returns `503` when any non-disabled check has `ok: false`.

---

## Subsystem checks

### Database health (`database`)

| Probe | `SELECT 1` via Prisma |
| Healthy | Query succeeds |
| Unhealthy | Connection or query failure |
| Fields | `latencyMs`, `details.probe` |

### Supabase health (`supabase`)

StorePilot uses **Prisma → Supabase PostgreSQL** (no Supabase JS client).

| Probe | Prisma connectivity + env validation |
| Healthy | `DATABASE_URL` reachable and `DIRECT_URL` configured |
| Degraded | DB reachable but `DIRECT_URL` missing |
| Unhealthy | `DATABASE_URL` missing or DB unreachable |
| Fields | `details.hostLooksLikeSupabase`, `details.accessMode: "prisma"` |

### Shopify API health (`shopify_api`)

| Probe | Configuration validation (no live Admin API call) |
| Healthy | API key, secret, app URL, and scopes valid |
| Unhealthy | Missing credentials or invalid scopes |
| Rationale | Avoids rate limits and shop-session dependency on health polls |

### Queue health (`queue`)

| Probe | `getJobQueueMetrics()` from `sync_jobs` table |
| Healthy | Metrics readable, `deadLetter === 0` |
| Degraded | `deadLetter > 0` (jobs need attention) |
| Unhealthy | Cannot query queue metrics |
| Fields | `queued`, `running`, `deadLetter`, `retrying` |

### Cron health (`cron`)

| Probe | `getCronWorkerHealth()` |
| Healthy | `CRON_SECRET` configured |
| Unhealthy | `CRON_SECRET` missing |
| Related route | `GET /cron/worker` returns `{ success, health }` |

### Worker health (`worker`)

| Probe | Aggregates cron config + queue metrics |
| Healthy | Cron configured and queue operational |
| Degraded | Queue has dead-letter jobs |
| Unhealthy | Cron misconfigured or queue unreachable |
| Note | Does not execute a worker cycle |

### AI health (`ai`)

| Probe | Configuration + optional provider `healthCheck()` |
| Disabled | `AI_PROVIDER` / `AI_MODEL` not set (non-blocking) |
| Healthy | Provider reachable within 5s timeout |
| Degraded | Provider configured but probe failed |
| Unhealthy | Configured but invalid (e.g. missing `OPENAI_API_KEY`) |

---

## Status values

| Status | Meaning |
|--------|---------|
| `healthy` | Operating normally |
| `degraded` | Functional with issues (e.g. dead-letter jobs) |
| `unhealthy` | Failing or misconfigured |
| `disabled` | Feature not configured (excluded from aggregate `ok`) |
| `unknown` | Reserved for future probes |

---

## Recommended monitoring configuration

### Vercel / external uptime

| Monitor | URL | Interval | Alert on |
|---------|-----|----------|----------|
| Liveness | `/health` | 1–5 min | non-200 |
| Readiness | `/health/ready` | 5 min | non-200 |
| Deep health | `/health/monitor` | 5–15 min | non-200 |
| Cron config | `GET /cron/worker` | 15 min | `success: false` |

### Alert thresholds

| Signal | Warning | Critical |
|--------|---------|----------|
| Liveness | — | HTTP ≠ 200 for 2+ checks |
| Readiness | Any check `ok: false` | HTTP 503 > 5 min |
| `database` unhealthy | — | Immediate |
| `queue.deadLetter` | > 0 | > 10 |
| `cron` unhealthy | — | Immediate (worker disabled) |
| `ai` degraded | Probe failure | N/A if disabled |

---

## Verification

Run from `store-pilot/`:

```bash
# Unit tests
npx vitest run app/services/__tests__/monitoring.test.ts
npx vitest run app/routes/__tests__/health.test.ts

# Local smoke (requires running dev server)
curl -s http://localhost:3000/health
curl -s http://localhost:3000/health/ready
curl -s http://localhost:3000/health/monitor
```

### Production smoke

```bash
curl -s -o /dev/null -w "liveness:%{http_code}\n" https://store-pilot-eta.vercel.app/health
curl -s -o /dev/null -w "readiness:%{http_code}\n" https://store-pilot-eta.vercel.app/health/ready
curl -s -o /dev/null -w "monitor:%{http_code}\n" https://store-pilot-eta.vercel.app/health/monitor
curl -s https://store-pilot-eta.vercel.app/cron/worker
```

---

## Security

- All health endpoints are **unauthenticated** by design (standard for probes).
- Responses never include secrets, connection strings, or API keys.
- Queue metrics expose counts only, not job payloads.
- AI health probe does not log prompts or completions.

---

## Files (Sprint 6)

| File | Role |
|------|------|
| `app/services/monitoring.server.ts` | Health check logic |
| `app/services/__tests__/monitoring.test.ts` | Service tests |
| `app/routes/health.tsx` | Liveness + query aliases |
| `app/routes/health.live.tsx` | Explicit liveness |
| `app/routes/health.ready.tsx` | Readiness |
| `app/routes/health.monitor.tsx` | Full monitoring |
| `app/routes/__tests__/health.test.ts` | Route tests |
| `docs/MONITORING_SETUP.md` | This document |

---

## Related documentation

- [`docs/VERCEL_SETUP_REPORT.md`](./VERCEL_SETUP_REPORT.md) — deployment and `/health` intro
- [`docs/ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md) — secrets required for readiness
- [`docs/LOGGING_ARCHITECTURE.md`](./LOGGING_ARCHITECTURE.md) — structured logs for incident correlation
- `store-pilot/docs/F42_WORKER_CRON_DEPLOYMENT.md` — cron worker operations
