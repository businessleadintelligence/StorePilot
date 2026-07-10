# Rollback Plan — StorePilot v1.0

**Date:** 2026-07-10 (RC3.5 serverless alignment)  
**Architecture:** Vercel-only

## Vercel application rollback

```bash
# Redeploy previous production deployment from Vercel dashboard
# Deployments → select previous successful deployment → Promote to Production
```

Or via CLI:

```bash
vercel rollback
```

**Recovery time:** < 5 minutes

## Database rollback

Prisma migrations are **forward-only**. Do not revert migrations in production unless a dedicated down migration was prepared.

If a migration caused failure:

1. Redeploy previous application version (compatible with current schema)
2. Fix migration in development
3. Deploy corrected forward migration

## Cron rollback

If a cron schedule change causes issues:

1. Revert `vercel.json` crons array to previous commit
2. Redeploy Vercel
3. Verify Cron Jobs tab shows restored schedules

## Environment rollback

```bash
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production  # restore previous value
vercel --prod  # redeploy to pick up env changes
```

## Verification after rollback

```bash
curl https://store-pilot-eta.vercel.app/health
curl https://store-pilot-eta.vercel.app/health/worker
curl https://store-pilot-eta.vercel.app/health/monitor
```

## Recovery time targets

| Component | Target |
|-----------|--------|
| Vercel app | < 5 min |
| Environment vars | < 10 min |
| Cron schedules | < 10 min (after redeploy) |
| Database (forward fix) | Variable |
