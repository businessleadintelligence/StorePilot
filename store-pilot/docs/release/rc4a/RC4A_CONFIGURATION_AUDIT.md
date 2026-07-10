# RC4A Step 9 — Production Configuration Audit

**Date:** 2026-07-10  
**Status:** ✅ **PASS**

## Files reviewed

| File | Purpose | Conflicts |
|------|---------|-----------|
| `vercel.json` | Build, crons, headers | ✅ None |
| `railway.toml` | Worker Dockerfile deploy | ✅ Aligns with `Dockerfile.worker` |
| `Dockerfile.worker` | Railway worker image | 🟡 Node 20 vs Vercel 24 |
| `package.json` | Scripts, engines, prisma | ✅ |
| `shopify.app.toml` | Scopes, webhooks, URL | ✅ Matches `SHOPIFY_APP_TOML_SCOPES` |
| `app/lib/shopify-app-config.ts` | Embedded scope fallback | ✅ C.2 fix |
| `scripts/copy-vercel-prompts.mjs` | Post-build prompt copy | ✅ In build chain |

## Cron schedules (`vercel.json`)

| Path | Schedule |
|------|----------|
| `/cron/worker` | `*/2 * * * *` |
| `/cron/dispatch/cleanup-jobs` | `0 2 * * *` |
| `/cron/dispatch/knowledge-refresh` | `0 3 * * *` |
| `/cron/dispatch/learning-engine` | `0 4 * * *` |
| `/cron/dispatch/daily-operating-plan` | `0 6 * * *` |

## Worker / queue

| Setting | Value |
|---------|-------|
| Worker poll | Railway `runContinuousWorker()` |
| Cron fallback | Every 2 min on Vercel |
| Graceful shutdown | `worker-runtime.server.ts` (RC1) |
| Restart policy (Railway) | ON_FAILURE, max 10 retries |

## Health routes

Present in build output: `health`, `health.ready`, `health.worker`, `health.monitor`, `health.live`

## Shopify scopes (canonical)

```
read_products,read_inventory,write_products,read_orders
```

## Verdict

**PASS** — Configuration internally consistent; Node version split noted.
