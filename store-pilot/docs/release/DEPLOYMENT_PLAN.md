# Deployment Plan — StorePilot v1.0 Launch

**Date:** 2026-07-10  
**Status:** 🔴 **NOT EXECUTED** — blocked at Git certification

## Preconditions (must be green)

- [ ] Git working tree clean and pushed
- [ ] Build certification pass (typecheck + lint + test + build)
- [ ] Database migrations applied to production
- [ ] Environment variables complete (including `AI_PLATFORM_ENABLED=true`)

## Deployment sequence

### Step 1 — Git freeze

```bash
git add -A
git commit -m "v1.0: production certification release — intelligence platform + C.2 remediation"
git tag v1.0.0-rc1
git push origin main --tags
```

### Step 2 — Database

```bash
# Against production DATABASE_URL
npx prisma migrate deploy
npx prisma migrate status
```

### Step 3 — Vercel

```bash
vercel --prod
# Verify deployment URL shows new commit hash
```

### Step 4 — Environment

```bash
vercel env add AI_PLATFORM_ENABLED production  # value: true
# Mirror all vars to Railway worker service
```

### Step 5 — Railway worker

```bash
railway up --service worker -d
```

### Step 6 — Health verification

```bash
curl https://store-pilot-eta.vercel.app/health
curl https://store-pilot-eta.vercel.app/health/ready
curl https://store-pilot-eta.vercel.app/health/worker
curl https://store-pilot-eta.vercel.app/health/monitor
```

All must return `ok: true` / HTTP 200.

### Step 7 — E2E fresh store

1. Create new Shopify development store
2. Install StorePilot
3. Time pipeline to 100%
4. Record in `docs/certification/16_END_TO_END_CERTIFICATION.md`

## Post-deploy monitoring (24h)

- `/health/worker` every 5 min (UptimeRobot or equivalent)
- Vercel cron logs for `/cron/worker`
- Supabase connection pool metrics
- `sync_jobs` dead_letter count = 0

## Rollback

See [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md).
