# Deployment Plan — StorePilot v1.0 Launch

**Date:** 2026-07-10 (RC3.5 serverless alignment)  
**Architecture:** GitHub → Vercel → Vercel Cron → Supabase → Shopify

## Preconditions (must be green)

- [ ] Git working tree clean and pushed
- [ ] Build certification pass (typecheck + lint + test + build)
- [ ] Database migrations applied to production
- [ ] Environment variables complete on Vercel production (see below)

## Required production environment (Vercel)

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes |
| `DIRECT_URL` | Yes |
| `SHOPIFY_API_KEY` | Yes |
| `SHOPIFY_API_SECRET` | Yes |
| `SHOPIFY_APP_URL` | Yes |
| `SCOPES` | Yes |
| `TOKEN_ENCRYPTION_KEY` | Yes |
| `CRON_SECRET` | Yes |
| `OPENAI_API_KEY` | Yes (when AI enabled) |
| `AI_PLATFORM_ENABLED` | Yes (`true`) |

No separate worker service or Railway deployment is required.

## Deployment sequence

### Step 1 — Git freeze

```bash
git add -A
git commit -m "v1.0: production certification release"
git tag v1.0.0-rc1
git push origin main --tags
```

### Step 2 — Database

```bash
# Against production DIRECT_URL
npx prisma migrate deploy
npx prisma migrate status
```

### Step 3 — Vercel

```bash
vercel --prod
# Verify deployment URL shows new commit hash
```

Confirm `vercel.json` includes all production crons (see `cron-scheduler.server.ts`).

### Step 4 — Environment

```bash
vercel env add CRON_SECRET production
vercel env add AI_PLATFORM_ENABLED production  # value: true
# Verify all required vars present: vercel env ls production
```

### Step 5 — Cron verification

1. Vercel Dashboard → Project → Cron Jobs — confirm 12 schedules active
2. Wait for next `/cron/worker` tick (every 2 minutes)
3. Vercel Dashboard → Logs — filter `path:/cron/worker` — expect `cron_worker_completed`

### Step 6 — Health verification

```bash
curl https://store-pilot-eta.vercel.app/health
curl https://store-pilot-eta.vercel.app/health/ready
curl https://store-pilot-eta.vercel.app/health/worker
curl https://store-pilot-eta.vercel.app/health/monitor
```

Pass criteria:

| Endpoint | Expected |
|----------|----------|
| `/health` | HTTP 200, `ok: true` |
| `/health/ready` | HTTP 200 when prompts + migrations + env green |
| `/health/worker` | HTTP 200 when `CRON_SECRET` set and queue healthy (`executionMode: serverless_cron`) |
| `/health/monitor` | HTTP 200 when all blocking checks pass |

### Step 7 — E2E fresh store

1. Create new Shopify development store
2. Install StorePilot
3. Monitor `sync_jobs` table — jobs should complete within cron cycles
4. Record in certification docs

## Post-deploy monitoring (24h)

- `/health/worker` every 5 min (UptimeRobot or equivalent)
- Vercel cron logs for `/cron/worker` and dispatch routes
- Supabase connection pool metrics
- `sync_jobs.dead_letter` count = 0
- Queue age via `/health/worker` → `queueExtended.oldestQueuedJobAgeMs`

## Rollback

See [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md).
