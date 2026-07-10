# RC4A Step 8 — Environment Variable Audit

**Date:** 2026-07-10  
**Secrets printed:** ⛔ **NO** — names and presence only

## Vercel production (`vercel env ls production`)

| Variable | Present | Environments | Notes |
|----------|---------|--------------|-------|
| `DATABASE_URL` | ✅ | Production | Encrypted |
| `DIRECT_URL` | ✅ | Production | Encrypted |
| `SHOPIFY_API_KEY` | ✅ | Dev, Preview, Production | Encrypted |
| `SHOPIFY_API_SECRET` | ✅ | Dev, Preview, Production | Encrypted |
| `SHOPIFY_APP_URL` | ✅ | Dev, Preview, Production | Encrypted |
| `SCOPES` | ✅ | Production | Encrypted |
| `TOKEN_ENCRYPTION_KEY` | ✅ | Production | Encrypted |
| `CRON_SECRET` | ✅ | Production | Encrypted |
| `OPENAI_API_KEY` | ✅ | Production | Encrypted |
| `AI_PROVIDER` | ✅ | Production | Encrypted |
| `AI_MODEL` | ✅ | Production | Encrypted |
| **`AI_PLATFORM_ENABLED`** | ❌ **MISSING** | — | **Critical for COO/explanations** |

## Railway

| Status | Reason |
|--------|--------|
| ⛔ **Not audited** | No linked project — cannot list variables |

## Parity matrix (expected)

| Variable | Vercel | Railway | Match |
|----------|--------|---------|-------|
| `DATABASE_URL` | ✅ | ⛔ | Unknown |
| `DIRECT_URL` | ✅ | ⛔ | Unknown |
| `SHOPIFY_*` | ✅ | N/A (worker) | — |
| `TOKEN_ENCRYPTION_KEY` | ✅ | Required | Unknown |
| `CRON_SECRET` | ✅ | Optional | Unknown |
| `OPENAI_API_KEY` | ✅ | If AI on worker | Unknown |
| `AI_PLATFORM_ENABLED` | ❌ | ❌ (assumed) | **Both must be set** |

## Format checks (non-secret)

| Variable | Format check |
|----------|--------------|
| `DATABASE_URL` | Supabase pooler host observed in Prisma output |
| `SCOPES` | Must match `read_products,read_inventory,write_products,read_orders` per TOML |
| `SHOPIFY_APP_URL` | Must be `https://store-pilot-eta.vercel.app` |

## Required RC4 actions

```bash
# NOT executed in RC4A
vercel env add AI_PLATFORM_ENABLED production   # value: true
# Mirror all worker-required vars on Railway after link
```

## Verdict

**FAIL** — `AI_PLATFORM_ENABLED` missing; Railway parity unverified.
