# Railway Deployment — Phase C.2

## Quick Start

```bash
# From repo root
railway login
railway init          # or railway link to existing project
railway service create worker
railway variables set DATABASE_URL=... SHOPIFY_API_KEY=... # etc.
railway up --service worker -d
```

## Configuration Files

| File | Purpose |
|------|---------|
| `railway.toml` | Build + restart policy |
| `Dockerfile.worker` | Production worker image |

## railway.toml

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.worker"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
numReplicas = 1
```

## Health

Worker process does not expose HTTP. Health is verified via **Vercel** endpoint that reads `worker_instances` table:

```bash
curl https://store-pilot-eta.vercel.app/health/worker
```

Worker registers heartbeat through `worker-registry.server.ts` on each cycle.

## Autoscaling

Railway: increase `numReplicas` or enable autoscaling in dashboard when queue depth sustains > N jobs.

Recommended starting point: **1 replica**, scale to 2+ when `oldest_queued_job_minutes > 5` consistently.

## Rollback

```bash
railway rollback --service worker
```

Vercel cron fallback (`*/2 * * * *`) continues processing if Railway worker down.
