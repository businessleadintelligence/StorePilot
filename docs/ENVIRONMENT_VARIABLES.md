# StorePilot — Environment Variables Audit

**Sprint:** 4 — Environment Secrets  
**Date:** 2026-07-09  
**Scope:** `store-pilot/` application code, Prisma schema, Vite config, local `.env`  
**Method:** Static codebase scan (read-only). No secret values are recorded in this document.

---

## Executive summary

| Metric | Count |
|--------|------:|
| Unique variables referenced in application/runtime code | **38** |
| Variables in local `store-pilot/.env` | **9** |
| **Unused** (in `.env`, not read by code) | **3** |
| **Missing from local `.env`** (required or commonly needed) | **12+** |
| **Misconfigured** in local `.env` (present but wrong value) | **1** (`SCOPES`) |

---

## Gap analysis

### Unused variables (safe to remove from `.env`)

These names exist in `store-pilot/.env` but **no application, Prisma, or Vite file reads them**:

| Variable | Notes |
|----------|-------|
| `SUPABASE_URL` | Supabase project URL — not referenced by StorePilot (Prisma-only data access) |
| `SUPABASE_ANON_KEY` | Supabase anon key — not referenced by application code |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — not referenced by application code |

### Missing variables (used by code, absent from local `.env`)

| Variable | Severity | Notes |
|----------|----------|-------|
| `TOKEN_ENCRYPTION_KEY` | **Critical** | Required for session/token encryption and startup readiness |
| `CRON_SECRET` | **Critical** | Required for background worker queue in production |
| `AI_PROVIDER` | High | Required when any AI agent executes |
| `AI_MODEL` | High | Required when any AI agent executes |
| `OPENAI_API_KEY` | High | Required when `AI_PROVIDER=openai` |
| `GOOGLE_CLIENT_ID` | Medium | Required for Google OAuth integrations |
| `GOOGLE_CLIENT_SECRET` | Medium | Required for Google OAuth integrations |
| `SHADOW_DATABASE_URL` | Low | Optional — Prisma shadow DB for migration dev workflows |
| `AI_TEMPERATURE` | Low | Has code default (`0.2`) |
| `AI_MAX_TOKENS` | Low | Has code default (`2048`) |
| `AI_TIMEOUT_MS` | Low | Has code default (`30000`) |
| `AI_STRUCTURED_OUTPUT_ENABLED` | Low | Has code default (`true`) |

### Misconfigured variables (present but incorrect)

| Variable | Issue |
|----------|-------|
| `SCOPES` | Local value includes `write_metaobjects,write_metaobject_definitions` and is **missing** required scopes `read_products`, `read_inventory`, `read_orders`. Must match `shopify.app.toml`: `read_products,read_inventory,write_products,read_orders` |

### Configuration duplication (not duplicate env keys)

These values are defined in **more than one place** and must be kept in sync:

| Concept | Sources |
|---------|---------|
| Shopify API key | `SHOPIFY_API_KEY` env ↔ `client_id` in `shopify.app.toml` |
| App URL | `SHOPIFY_APP_URL` env ↔ `application_url` in `shopify.app.toml` ↔ Vercel domain |
| OAuth scopes | `SCOPES` env ↔ `scopes` in `shopify.app.toml` |

---

## Local `.env` inventory (names only)

Variables currently defined in `store-pilot/.env`:

```
DATABASE_URL
DIRECT_URL
SCOPES
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
```

---

## Master reference table

### Shopify & core platform

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `SHOPIFY_API_KEY` | Shopify app client ID (public) | **Yes** | — | Set by Shopify CLI or `.env` | **Yes** — Vercel Production | No | `app/shopify.server.ts`, `app/routes/app.tsx`, `app/routes/auth.google.callback.tsx`, `app/services/startup-readiness.server.ts`, `app/production/production-security.ts` |
| `SHOPIFY_API_SECRET` | OAuth + webhook HMAC validation | **Yes** | `""` (empty string fallback in shopify config) | `.env` or CLI | **Yes** | **Yes** | `app/shopify.server.ts`, `app/google/oauth/google-oauth.service.ts`, `app/services/startup-readiness.server.ts`, `app/production/production-security.ts` |
| `SHOPIFY_APP_URL` | Canonical public app URL | **Yes** | `""` | Tunnel URL from `shopify app dev` | **Yes** — must match Vercel domain | No | `app/shopify.server.ts`, `app/routes/auth.google.callback.tsx`, `app/google/oauth/google-oauth.service.ts`, `app/services/startup-readiness.server.ts`, `vite.config.ts` |
| `SCOPES` | Comma-separated Shopify OAuth scopes | **Yes** | — | Must match `shopify.app.toml` | **Yes** | No | `app/shopify.server.ts`, `app/services/startup-readiness.server.ts`, `app/lib/privacy-by-architecture.ts` |
| `SHOP_CUSTOM_DOMAIN` | Allow custom shop domains for auth | No | — (disabled) | Optional | Optional | No | `app/shopify.server.ts` |

### Database (Prisma)

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string (pooled) | **Yes** | — | Local/Supabase `.env` | **Yes** | **Yes** | `prisma/schema.prisma`, `app/services/startup-readiness.server.ts`, `app/production/production-security.ts` |
| `DIRECT_URL` | Direct Postgres URL for migrations | **Yes** (migrations) | — | `.env` | **Yes** (deploy/migrate) | **Yes** | `prisma/schema.prisma` |
| `SHADOW_DATABASE_URL` | Prisma shadow database for `migrate dev` | No | — | Optional CI/local | Not needed at runtime | **Yes** | `prisma/schema.prisma` |

### Security & encryption

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `TOKEN_ENCRYPTION_KEY` | Encrypts Shopify sessions and connector API tokens at rest | **Yes** | — | Test default in `vitest.setup.ts` only | **Yes** | **Yes** | `app/services/token-crypto.server.ts`, `app/google/oauth/google-oauth.service.ts`, `app/services/startup-readiness.server.ts`, `app/production/production-security.ts` |

### Background worker

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `CRON_SECRET` | Authenticates `POST /cron/worker` via `x-cron-secret` header | **Yes** (worker queue) | — | Test default in `vitest.setup.ts` | **Yes** | **Yes** | `app/routes/cron.worker.tsx`, `app/services/cron-worker.server.ts`, `app/services/startup-readiness.server.ts` |
| `CRON_JOB_BATCH_SIZE` | Max jobs processed per worker cycle | No | `3` | Optional | Optional | No | `app/services/worker.server.ts` |

### AI platform

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `AI_PROVIDER` | AI provider ID (e.g. `openai`) | **Yes** (when AI runs) | — | Optional until AI tested | **Yes** (if AI enabled) | No | `app/ai/providers/index.ts`, `app/ai/core/ai-config.ts` |
| `AI_MODEL` | Model identifier | **Yes** (when AI runs) | — | Optional | **Yes** (if AI enabled) | No | `app/ai/providers/index.ts`, `app/ai/core/ai-config.ts` |
| `OPENAI_API_KEY` | OpenAI API authentication | **Yes** (when `AI_PROVIDER=openai`) | `""` | Optional | **Yes** (if OpenAI) | **Yes** | `app/ai/providers/index.ts`, `app/ai/providers/openai/openai-provider.ts` |
| `AI_TEMPERATURE` | LLM sampling temperature | No | `0.2` | Optional | Optional | No | `app/ai/providers/index.ts`, `app/ai/core/ai-config.ts` |
| `AI_MAX_TOKENS` | Max tokens per request | No | `2048` | Optional | Optional | No | `app/ai/providers/index.ts`, `app/ai/core/ai-config.ts` |
| `AI_TIMEOUT_MS` | Request timeout (ms) | No | `30000` | Optional | Optional | No | `app/ai/providers/index.ts`, `app/ai/core/ai-config.ts` |
| `AI_STRUCTURED_OUTPUT_ENABLED` | Enable JSON structured output | No | `true` | Optional | Optional | No | `app/ai/providers/index.ts`, `app/ai/core/ai-config.ts` |
| `AI_OPENAI_PROMPT_USD_PER_1K` | OpenAI prompt cost estimate (USD/1k tokens) | No | `0` | Optional | Optional | No | `app/ai/providers/openai/openai-provider.ts` |
| `AI_OPENAI_COMPLETION_USD_PER_1K` | OpenAI completion cost estimate (USD/1k tokens) | No | `0` | Optional | Optional | No | `app/ai/providers/openai/openai-provider.ts` |
| `AI_OPENAI_CONTEXT_WINDOW_TOKENS` | Model context window metadata | No | `null` | Optional | Optional | No | `app/ai/providers/openai/openai-provider.ts` |
| `AI_OPENAI_MODEL_DESCRIPTION` | Human-readable model description | No | — | Optional | Optional | No | `app/ai/providers/openai/openai-provider.ts` |

### Google integrations

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No (feature-gated) | — | Optional | Optional (if Google connectors used) | No | `app/google/oauth/google-oauth.service.ts`, `app/google/oauth/google-refresh.service.ts` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No (feature-gated) | — | Optional | Optional (if Google connectors used) | **Yes** | `app/google/oauth/google-oauth.service.ts`, `app/google/oauth/google-refresh.service.ts` |

### Billing

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `BILLING_TEST_MODE` | Force Shopify test billing charges | No | Off (`!== "1"`) | Implicit via `NODE_ENV !== "production"` | Should be **unset** or `0` | No | `app/billing/shopify-billing.server.ts` |

### Runtime & development tooling

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `NODE_ENV` | Runtime mode (`development` / `production` / `test`) | Auto | `development` locally | Set by CLI/test runner | Vercel sets `production` | No | `app/db.server.ts`, `app/billing/billing-config-validator.ts`, `app/billing/shopify-billing.server.ts`, `app/routes/app.dev.sync-products.tsx`, `app/routes/internal.founder.tsx` |
| `PORT` | HTTP server port | No | `3000` | Shopify CLI / local serve | Vercel manages | No | `vite.config.ts`, `app/shopify.server.ts` |
| `FRONTEND_PORT` | Vite HMR client port (tunnel) | No | `8002` | Shopify tunnel dev | Not used | No | `vite.config.ts` |
| `HOST` | Shopify CLI tunnel host workaround | No | — | Injected by Shopify CLI; mapped to `SHOPIFY_APP_URL` | Not used | No | `vite.config.ts` |
| `PRISMA_CLIENT_ENGINE_TYPE` | Prisma query engine mode | No | Library default | `binary` on Windows ARM64 (see README) | Usually unset | No | Documented in `store-pilot/README.md` only — not read by app code |

### Vercel platform (automatic)

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `VERCEL` | Indicates Vercel runtime | Auto | — | — | `1` | No | Vercel platform |
| `VERCEL_ENV` | Deployment environment | Auto | — | — | `production` / `preview` | No | Vercel platform |
| `VERCEL_URL` | Deployment hostname | Auto | — | — | Per deployment | No | Vercel platform |
| `VERCEL_DEPLOYMENT_ID` | Deployment identifier | Auto | — | — | Per deployment | No | `node_modules/@vercel/react-router/entry.server.js` |
| `VERCEL_SKEW_PROTECTION_ENABLED` | Enable skew-protection cookies | Auto | — | — | `1` when enabled | No | `node_modules/@vercel/react-router/entry.server.js` |

### Test & simulation only (never set in production)

| Variable | Purpose | Required | Default | Development | Production | Secret? | Used by |
|----------|---------|----------|---------|-------------|------------|---------|---------|
| `STORE_SYNC_SIMULATE_GRAPHQL_FAILURE` | Force store sync GraphQL failure | No | Off | Tests / manual debug (`"1"`) | **Never** | No | `app/services/store.server.ts` |
| `STORE_SYNC_SIMULATE_PRISMA_FAILURE` | Force store sync DB failure | No | Off | Tests / manual debug (`"1"`) | **Never** | No | `app/services/store.server.ts` |
| `USER_SYNC_SIMULATE_GRAPHQL_FAILURE` | Force user sync GraphQL failure | No | Off | Tests (`"1"`) | **Never** | No | `app/services/user.server.ts` |
| `USER_SYNC_SIMULATE_PRISMA_FAILURE` | Force user sync DB failure | No | Off | Tests (`"1"`) | **Never** | No | `app/services/user.server.ts` |
| `PRODUCT_SYNC_SIMULATE_GRAPHQL_FAILURE` | Force product sync GraphQL failure | No | Off | Tests (`"1"`) | **Never** | No | `app/services/product.server.ts` |
| `PRODUCT_SYNC_SIMULATE_PRISMA_FAILURE` | Force product sync DB failure | No | Off | Tests (`"1"`) | **Never** | No | `app/services/product.server.ts` |

---

## Required variables by environment

### Production (minimum for app boot + Shopify)

```
DATABASE_URL
DIRECT_URL
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL
SCOPES
TOKEN_ENCRYPTION_KEY
CRON_SECRET
```

Validated by `getStartupReadiness()` in `app/services/startup-readiness.server.ts` and `validateProductionEnvironment()` in `app/production/production-security.ts`.

### Production (additional — when features enabled)

```
AI_PROVIDER
AI_MODEL
OPENAI_API_KEY          # when AI_PROVIDER=openai
GOOGLE_CLIENT_ID        # when Google Analytics/Search Console OAuth used
GOOGLE_CLIENT_SECRET    # when Google OAuth used
```

### Development (local `shopify app dev`)

| Variable | Typical source |
|----------|----------------|
| `SHOPIFY_API_KEY` | Shopify CLI / `.env` |
| `SHOPIFY_API_SECRET` | Shopify CLI / `.env` |
| `SHOPIFY_APP_URL` | Tunnel URL (CLI) or `HOST` mapped in `vite.config.ts` |
| `SCOPES` | `.env` — must match `shopify.app.toml` |
| `DATABASE_URL` | `.env` (Supabase/local Postgres) |
| `DIRECT_URL` | `.env` |
| `TOKEN_ENCRYPTION_KEY` | `.env` (tests use fallback) |
| `CRON_SECRET` | `.env` (tests use fallback) |
| `PORT` / `FRONTEND_PORT` / `HOST` | Shopify CLI |

---

## Startup readiness checks

`GET /health?ready=1` and `getStartupReadiness()` evaluate:

| Check ID | Env variable(s) |
|----------|-----------------|
| `cron_secret` | `CRON_SECRET` |
| `worker_queue` | `CRON_SECRET` (queue disabled without it) |
| `shopify_api_secret` | `SHOPIFY_API_SECRET` |
| `shopify_scopes` | `SCOPES` (minimum + prohibited scope validation) |
| `shopify_api_key` | `SHOPIFY_API_KEY` |
| `database_url` | `DATABASE_URL` |
| `token_encryption_key` | `TOKEN_ENCRYPTION_KEY` |
| `migrations` | Database state (not an env var) |
| `webhook_registration_config` | `SHOPIFY_APP_URL` + `SHOPIFY_API_SECRET` |

---

## Secrets handling rules

1. **Never commit** `.env` to git (ensure `.gitignore` covers it).
2. Store production secrets only in **Vercel Environment Variables** (Production scope).
3. Rotate `CRON_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `SHOPIFY_API_SECRET` on compromise.
4. `SHOPIFY_API_KEY` is public (embedded in client) — still do not commit unnecessarily.
5. Connector tokens (Microsoft Clarity, Google refresh tokens) are **encrypted in the database** using `TOKEN_ENCRYPTION_KEY` — not stored as env vars.

---

## Recommended actions

### Local `.env`

1. **Remove unused:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
2. **Add missing:** `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`
3. **Fix `SCOPES`:** `read_products,read_inventory,write_products,read_orders`
4. **Add when testing AI:** `AI_PROVIDER`, `AI_MODEL`, `OPENAI_API_KEY`
5. **Add when testing Google OAuth:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Vercel Production

Set all variables in the **Production** column marked **Yes** above. Cross-reference [`docs/VERCEL_SETUP_REPORT.md`](./VERCEL_SETUP_REPORT.md).

---

## Audit methodology

- Scanned `process.env.*` and `env("...")` references across `store-pilot/app/`, `prisma/schema.prisma`, and `vite.config.ts`
- Compared against `store-pilot/.env` variable **names only** (values not read or documented)
- Excluded test files from "Used by" unless variable is test-only
- No application code was modified during this audit
