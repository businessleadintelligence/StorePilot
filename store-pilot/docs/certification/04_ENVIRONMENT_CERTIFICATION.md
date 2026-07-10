# 04 — Environment Certification

**Date:** 2026-07-10T09:00Z  
**Status:** 🟡 **PARTIAL**

**Source:** `vercel env ls production` (names only — values encrypted)

## Variable checklist

| Variable | Vercel Prod | Format | Status |
|----------|-------------|--------|--------|
| `SHOPIFY_API_KEY` | ✅ Present | Encrypted | 🟢 |
| `SHOPIFY_API_SECRET` | ✅ Present | Encrypted | 🟢 |
| `SHOPIFY_APP_URL` | ✅ Present | Encrypted | 🟢 |
| `SCOPES` | ✅ Present | Encrypted | 🟢 |
| `DATABASE_URL` | ✅ Present | Encrypted | 🟢 |
| `DIRECT_URL` | ✅ Present | Encrypted | 🟢 |
| `TOKEN_ENCRYPTION_KEY` | ✅ Present | Encrypted | 🟢 |
| `CRON_SECRET` | ✅ Present | Encrypted | 🟢 |
| `OPENAI_API_KEY` | ✅ Present | Encrypted | 🟢 |
| `AI_PROVIDER` | ✅ Present | Encrypted | 🟢 |
| `AI_MODEL` | ✅ Present | Encrypted | 🟢 |
| `AI_PLATFORM_ENABLED` | ❌ **Missing** | — | 🔴 |
| `SESSION_SECRET` | ❌ Not set | N/A | ⚪ Not used (Prisma Session table) |

## Railway worker env

| Status | Evidence |
|--------|----------|
| 🔴 NOT VERIFIED | Worker service not deployed; no env mirror confirmed |

## Required human action

```bash
vercel env add AI_PLATFORM_ENABLED production
# Enter: true

# Railway: copy all Vercel production vars to worker service
railway variables set AI_PLATFORM_ENABLED=true ...
```

## Verification

```bash
vercel env ls production | grep AI_PLATFORM
curl https://store-pilot-eta.vercel.app/health/ready  # AI checks indirect
```

## Certification result

**NOT CERTIFIED** — `AI_PLATFORM_ENABLED` missing; Railway env not verified.
