# RC4 Environment Certification

**Date:** 2026-07-10  
**Phase:** RC4 — Environment Variables  
**Status:** 🔴 **NOT VERIFIED** (full parity)

## Production readiness probe evidence

From `/health/ready` (2026-07-10T10:22:24Z):

| Variable / check | Production status |
|------------------|-------------------|
| `DATABASE_URL` | ✅ ok |
| `TOKEN_ENCRYPTION_KEY` | ✅ ok + roundtrip |
| `SHOPIFY_API_KEY` | ✅ ok |
| `SHOPIFY_API_SECRET` | ✅ ok |
| `SHOPIFY_SCOPES` | ✅ configured |
| `CRON_SECRET` | ✅ ok |
| `AI_PLATFORM_ENABLED` | ⛔ **Not in readiness checks** — historically missing |
| Scope TOML parity | 🔴 **FAIL** — `shopify_scope_drift` |
| Prompt registry | 🔴 **FAIL** — bundle missing prompts |
| Migrations path | 🔴 **FAIL** — `/var/task/prisma/migrations` missing |

## Required variables (checklist)

| Variable | Vercel | Railway worker | Verified |
|----------|--------|----------------|----------|
| `DATABASE_URL` | Required | Required | 🟡 Partial (probe only) |
| `DIRECT_URL` | Required | Optional | 🟡 monitor shows configured |
| `SHOPIFY_API_KEY` | Required | — | ✅ |
| `SHOPIFY_API_SECRET` | Required | — | ✅ |
| `SCOPES` / `SHOPIFY_SCOPES` | Required | — | 🟡 drift |
| `OPENAI_API_KEY` | Required | — | ✅ AI probe healthy |
| `AI_PLATFORM_ENABLED` | **Must be `true`** | Mirror | ⛔ Not verified |
| `TOKEN_ENCRYPTION_KEY` | Required | Mirror | ✅ |
| `CRON_SECRET` | Required | — | ✅ |
| Worker env mirror | — | Required | ⛔ Not verified |

## Parity verification

**Not executed** — requires Vercel dashboard + Railway dashboard export comparison post-deploy.

## Certification

**RC4 Environment: FAIL** — scope drift and missing RC1 bundle on production; full parity not verified.
