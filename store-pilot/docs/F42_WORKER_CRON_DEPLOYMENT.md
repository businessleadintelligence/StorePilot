# F.4.2 — Worker Cron Deployment

This document describes how to deploy automatic background job processing for StorePilot using the `/cron/worker` HTTP endpoint.

## Overview

StorePilot enqueues async jobs during store install and onboarding. The worker cron route invokes `runWorkerCycle()` on a schedule so queued jobs are processed without manual intervention.

| Item | Value |
|------|-------|
| Route | `POST /cron/worker` |
| Auth | Shared secret header (not Shopify session auth) |
| Worker | One job per request via F.3.8 worker engine |

## Environment variable

Set a strong random secret in production:

```bash
CRON_SECRET=your-long-random-secret-here
```

Generate an example (local):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Requirements:**

- Must be set in production before enabling cron
- Must match the `x-cron-secret` header sent by your scheduler
- Never commit the value to git or log it in application output

Also ensure existing StorePilot env vars are configured (`DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL`, etc.).

## Vercel cron example

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/cron/worker",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

Set `CRON_SECRET` in the Vercel project environment variables.

Vercel cron invokes the path with `GET` by default. **StorePilot requires `POST`.** Use one of:

1. **Vercel Cron with POST** (if your plan supports custom method/headers via an edge proxy or scheduled serverless function wrapper)
2. **External scheduler** (recommended for full control): GitHub Actions, Supabase cron + pg_net, or a small cron service that sends `POST` with the secret header

Example external scheduler target:

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `https://your-app.vercel.app/cron/worker` |
| Header | `x-cron-secret: <CRON_SECRET>` |
| Schedule | Every 2 minutes (`*/2 * * * *`) |

## Manual curl example

Replace placeholders before running:

```bash
curl -X POST "https://your-app.vercel.app/cron/worker" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Success response (200):**

```json
{
  "success": true,
  "workerId": "cron-worker-1719012345678",
  "processed": {
    "jobId": "...",
    "jobType": "bootstrap_products",
    "status": "completed",
    "workerId": "cron-worker-1719012345678"
  }
}
```

When the queue is empty, `processed` is `null`.

**Unauthorized (401):**

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Worker failure (500):**

```json
{
  "success": false,
  "error": "Worker cycle failed"
}
```

## Security notes

- The route does **not** use Shopify merchant authentication.
- Only requests with a valid `x-cron-secret` header matching `CRON_SECRET` are accepted.
- Non-`POST` requests receive `405 Method Not Allowed`.
- Secret values are never written to logs.

## Operations

Each cron hit processes **one** queued job. For backlogged queues, keep the schedule frequent (every 1–2 minutes) or run multiple invocations after large installs.

Monitor logs for:

- `[cron-worker]` with `cron_worker_started` / `cron_worker_completed`
- `[worker]` job claim/complete events
- `[job-service]` enqueue/claim/fail events

## Rollback

To disable automatic processing:

1. Remove or pause the external cron schedule
2. Jobs remain in `sync_jobs` until processing resumes
3. Manual fallback: invoke `runWorkerCycle(workerId)` from a secure script (as used in F.3.10)
