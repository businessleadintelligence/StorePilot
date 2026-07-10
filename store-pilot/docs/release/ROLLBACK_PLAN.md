# Rollback Plan — StorePilot v1.0

**Last updated:** 2026-07-10

## Application rollback (Vercel)

```bash
# List recent deployments
vercel ls store-pilot --prod

# Promote previous deployment
vercel rollback <deployment-url> --prod
```

**Known good baseline:** deployment from commit `b1789a7` (current production as of 2026-07-10).

## Worker rollback (Railway)

```bash
railway rollback --service worker
# Or redeploy previous image from Railway dashboard → Deployments
```

## Database rollback

**Strategy:** Forward-only migrations. No automatic down-migration in production.

| Action | Command |
|--------|---------|
| Verify applied | `npx prisma migrate status` |
| Emergency restore | Restore Supabase point-in-time backup (dashboard) |

**Before each release:**

1. Confirm Supabase PITR backup window enabled
2. Export schema: `npx prisma migrate diff`
3. Record `_prisma_migrations` row count

## Environment rollback

```bash
vercel env pull .env.production.backup
# Restore prior values via Vercel dashboard → Environment Variables → history
```

## Rollback triggers

- `/health/ready` 503 persists > 15 min after deploy
- Fresh install bootstrap failure rate > 0
- GDPR webhook failure
- Data corruption in sync_jobs or store_onboarding

## Recovery time objective

| Component | Target |
|-----------|--------|
| Vercel app | < 5 min (rollback promote) |
| Railway worker | < 10 min |
| Database | < 1 hr (PITR, last resort) |
