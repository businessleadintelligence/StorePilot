# Worker Deployment — Phase C.2

## Architecture

| Component | Role |
|-----------|------|
| **Railway worker** | Primary — continuous `npm run worker` |
| **Vercel cron** | Fallback — `GET /cron/worker` every 2 min |

## Local / Docker

```bash
# Build
npm run build

# Run worker (production)
npm run worker
```

`Dockerfile.worker` — Node 20 Alpine, runs `npm run worker` after build.

## Railway Deployment

### 1. Create service

```bash
railway login
railway link
railway up --service worker
```

Uses `railway.toml`:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.worker"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
numReplicas = 1
```

### 2. Required environment variables

Copy from Vercel production:

- `DATABASE_URL`, `DIRECT_URL`
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL`
- `TOKEN_ENCRYPTION_KEY`
- `CRON_SECRET`
- `OPENAI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`
- Optional tuning: `JOB_LOCK_DURATION_MS`, `WORKER_BATCH_SIZE`, `WORKER_HEARTBEAT_INTERVAL_MS`

### 3. Verify

```bash
curl https://store-pilot-eta.vercel.app/health/worker
```

**Pass criteria:** `activeWorkers >= 1`, `status: healthy`

## Worker Runtime Features (existing)

- `claimNextJob` → `claimed` → `beginJobExecution` → `running`
- Heartbeat + lock extension
- Stale job release
- `markPhaseStarted()` on onboarding jobs (C.2 addition)
- Graceful shutdown via `worker-runtime.server.ts`

## Cron Fallback

`vercel.json` updated:

```json
{ "path": "/cron/worker", "schedule": "*/2 * * * *" }
```

Authorized via `Authorization: Bearer $CRON_SECRET`.

Unauthorized GET returns health-only (no job execution).

## Monitoring Alerts (`worker-health.server.ts`)

- `no_active_workers`
- `stale_workers:N`
- `dead_letter_jobs:N`
- `cancelled_bootstrap_jobs:N` (new)
- `cancelled_jobs:N` when queue depth > 0
- `oldest_queued_job_minutes:N`
