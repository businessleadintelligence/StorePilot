# StorePilot — Vercel Production Setup Report

**Sprint:** 2 — Vercel Production  
**Date:** 2026-07-09  
**App root:** `store-pilot/`  
**Production URL:** `https://store-pilot-eta.vercel.app`

---

## Executive summary

StorePilot is configured for **production-only** deployment on Vercel using the official `@vercel/react-router` preset. The app builds with `npm run build`, exposes a public health endpoint, applies security and caching headers via `vercel.json`, uses Vercel-native response streaming, and serves route-level error boundaries for merchant-facing failures.

| Gate | Result |
|------|--------|
| `npm run build` | **PASS** |
| Health route tests (`app/routes/__tests__/health.test.ts`) | **3/3 PASS** |

---

## Vercel project settings

Configure these in the [Vercel project dashboard](https://vercel.com/dashboard) (Settings → General / Build & Development):

| Setting | Value |
|---------|-------|
| **Root Directory** | `store-pilot` |
| **Framework Preset** | React Router (auto-detected with preset) |
| **Node.js Version** | `22.x` (matches `engines` in `package.json`: `>=20.19 <22 \|\| >=22.12`) |
| **Install Command** | `npm install` |
| **Build Command** | `npm run build` |
| **Development Command** | Not used in production |
| **Output Directory** | Managed by `@vercel/react-router` preset (see below) |

> **Important:** Set the Vercel **Root Directory** to `store-pilot`. The repository root (`STOREPILOT/`) contains docs and assets outside the deployable app.

---

## Production build only

Production builds use:

```bash
npm run build
# expands to:
prisma generate && react-router build
```

| Concern | Production behavior |
|---------|---------------------|
| `NODE_ENV` | Vercel sets `production` automatically |
| `npm run dev` | Local development only — never used on Vercel |
| `postinstall` | Runs `prisma generate` on every install (ensures Prisma Client matches schema) |
| Migrations | **Not** run during build. Run `npx prisma migrate deploy` separately (CI step, release hook, or Supabase migration pipeline) before or immediately after deploy |

### Build dependency fixes (required for server bundle)

During verification, the server build failed to resolve transitive imports. These were added as **explicit** `dependencies`:

| Package | Reason |
|---------|--------|
| `@vercel/react-router` | Official Vercel deployment preset |
| `zod` | Used by `app/ai/schemas/*` (28 files) |
| `openai` | Used by `app/ai/providers/openai/openai-client.ts` |

---

## Build command & output directory

### Build command

Declared in both `package.json` and `store-pilot/vercel.json`:

```
npm run build
```

### Output directory

With the Vercel preset (`react-router.config.ts`), React Router emits the **Vercel Build Output API** layout. Do **not** set a manual Output Directory in the dashboard.

| Artifact | Path (local build) |
|----------|-------------------|
| Client static assets | `build/client/` |
| Server function bundle | `build/server/nodejs_eyJydW50aW1lIjoibm9kZWpzIn0/index.js` |
| Vercel build manifest | `.vercel/react-router-build-result.json` |

On Vercel, the preset converts this into `.vercel/output/` during deployment. Static files are served from the CDN; SSR routes run as Node.js serverless functions.

### Configuration files added

| File | Purpose |
|------|---------|
| `store-pilot/react-router.config.ts` | Enables `vercelPreset()` for SSR + function splitting |
| `store-pilot/vercel.json` | Build commands, security headers, asset caching |
| `store-pilot/app/routes/health.tsx` | Public liveness/readiness endpoint |

### Server entry (Vercel streaming)

`app/entry.server.tsx` delegates to `@vercel/react-router/entry.server` while preserving Shopify document headers (`addDocumentResponseHeaders`). This enables:

- Vercel-compatible response streaming
- Skew protection cookies when `VERCEL_SKEW_PROTECTION_ENABLED=1`
- Bot-aware shell rendering (`isbot`)

---

## Production domains

| Domain | Role |
|--------|------|
| `https://store-pilot-eta.vercel.app` | Primary Vercel production URL (configured in `shopify.app.toml`) |
| `*.vercel.app` | Default Vercel deployment hostname per branch/preview |

### Required environment alignment

`SHOPIFY_APP_URL` **must** match the canonical production URL:

```
SHOPIFY_APP_URL=https://store-pilot-eta.vercel.app
```

Also update in:

- Vercel → Settings → Environment Variables (Production)
- `shopify.app.toml` → `application_url`
- Shopify Partner Dashboard → App setup → App URL

### Custom domain (optional)

To add a branded domain (e.g. `app.storepilot.com`):

1. Vercel → Project → Settings → Domains → Add
2. Update `SHOPIFY_APP_URL` and `shopify.app.toml` `application_url`
3. Run `shopify app deploy` to sync Partner Dashboard URLs

---

## Environment variables

Set all variables in **Vercel → Settings → Environment Variables → Production**. Never commit secrets to git.

### Required (production)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (Supabase pooler recommended for serverless) |
| `DIRECT_URL` | Direct Postgres URL for Prisma migrations |
| `SHOPIFY_API_KEY` | Shopify app client ID |
| `SHOPIFY_API_SECRET` | Webhook HMAC + OAuth secret |
| `SHOPIFY_APP_URL` | Canonical app URL (`https://store-pilot-eta.vercel.app`) |
| `SCOPES` | `read_products,read_inventory,write_products,read_orders` |
| `TOKEN_ENCRYPTION_KEY` | Encrypts offline access tokens at rest |
| `CRON_SECRET` | Authenticates `POST /cron/worker` background jobs |

### AI platform (required when AI agents run)

| Variable | Purpose |
|----------|---------|
| `AI_PROVIDER` | e.g. `openai` |
| `AI_MODEL` | e.g. `gpt-4o-mini` |
| `OPENAI_API_KEY` | OpenAI API key |
| `AI_TEMPERATURE` | Optional (default `0.2`) |
| `AI_MAX_TOKENS` | Optional (default `2048`) |
| `AI_TIMEOUT_MS` | Optional (default `30000`) |
| `AI_STRUCTURED_OUTPUT_ENABLED` | Optional (default `true`) |

### Google integrations (optional)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |

### Operations (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `CRON_JOB_BATCH_SIZE` | `3` | Jobs processed per worker cycle |
| `BILLING_TEST_MODE` | off in production | Shopify test charges |
| `SHOP_CUSTOM_DOMAIN` | — | Custom shop domain allowlist |

### Vercel-managed (automatic)

| Variable | Purpose |
|----------|---------|
| `VERCEL` | `1` on Vercel |
| `VERCEL_URL` | Deployment hostname |
| `VERCEL_ENV` | `production` / `preview` / `development` |
| `VERCEL_DEPLOYMENT_ID` | Skew protection |
| `NODE_ENV` | `production` |

### Not used by application runtime

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` may exist in your Supabase project but are **not** read by StorePilot (Prisma-only data access).

---

## Health endpoint

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | None | **Liveness** — confirms the app responds |
| `/health?ready=1` | GET | None | **Readiness** — runs `getStartupReadiness()` checks |

### Liveness example

```bash
curl -s https://store-pilot-eta.vercel.app/health
```

```json
{
  "ok": true,
  "mode": "liveness",
  "service": "store-pilot",
  "timestamp": "2026-07-09T07:00:00.000Z"
}
```

### Readiness example

```bash
curl -s https://store-pilot-eta.vercel.app/health?ready=1
```

Returns `200` when all startup checks pass; `503` when any check fails (missing secrets, pending migrations, etc.).

### Related endpoints

| Endpoint | Notes |
|----------|-------|
| `GET /cron/worker` | Worker queue health JSON (does not run jobs) |
| `POST /cron/worker` | Requires `x-cron-secret: <CRON_SECRET>` header |

See `store-pilot/docs/F42_WORKER_CRON_DEPLOYMENT.md` for worker scheduling. Vercel Cron sends `GET` by default; use an external scheduler for `POST /cron/worker`.

---

## Security headers

Applied via `store-pilot/vercel.json` for all routes, plus Shopify CSP for embedded app routes.

### Global headers (`vercel.json`)

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-DNS-Prefetch-Control` | `on` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

### Shopify embedded app headers

`addDocumentResponseHeaders()` in `app/entry.server.tsx` sets Shopify-required `Content-Security-Policy` including `frame-ancestors` for admin embedding. **Do not** set `X-Frame-Options: DENY` globally — it would break Shopify App Bridge embedding.

### Route-level headers

Embedded app routes under `/app/*` export Shopify `boundary.headers()` for OAuth session handling.

---

## Compression

Vercel applies **automatic Brotli/gzip compression** at the CDN edge for text responses (HTML, JSON, JS, CSS). No application-level compression middleware is required.

Build output already reports gzip sizes (e.g. client chunks). Vercel serves pre-compressed static assets from the edge network.

---

## Caching

### Static assets

`vercel.json` sets immutable caching for hashed build assets:

```
/assets/*  →  Cache-Control: public, max-age=31536000, immutable
```

React Router emits fingerprinted files under `build/client/assets/`.

### Health endpoint

```
/health  →  Cache-Control: no-store
```

Also enforced in `app/routes/health.tsx` via the route `headers()` export.

### Dynamic SSR routes

Merchant routes (`/app/*`), webhooks, and auth routes are **not** CDN-cached. Each request is rendered by serverless functions with fresh data.

### Route-level cache headers (future)

React Router supports per-route `headers()` exports with `s-maxage` and `stale-while-revalidate` for cacheable loader data. No merchant routes use edge caching today.

---

## Error pages

| Layer | Mechanism |
|-------|-----------|
| **Root** | `ErrorBoundary` in `app/root.tsx` — HTML fallback for unhandled errors |
| **Embedded app** | `ErrorBoundary` + `boundary.error()` in `app/routes/app.tsx` and child routes |
| **Auth** | `app/routes/auth.login/error.server.tsx` |
| **Platform** | Vercel serves its own 502/504 page if a function crashes before responding |

Root error page shows a human-readable message and a link back to `/app`. Shopify embedded routes preserve OAuth/App Bridge headers through Shopify's boundary helpers.

---

## Files changed in this sprint

| File | Change |
|------|--------|
| `store-pilot/react-router.config.ts` | **Added** — Vercel preset |
| `store-pilot/vercel.json` | **Added** — headers, build commands |
| `store-pilot/app/routes/health.tsx` | **Added** — health endpoint |
| `store-pilot/app/routes/__tests__/health.test.ts` | **Added** — tests |
| `store-pilot/app/entry.server.tsx` | **Updated** — Vercel streaming handler |
| `store-pilot/app/root.tsx` | **Updated** — root ErrorBoundary |
| `store-pilot/package.json` | **Updated** — `@vercel/react-router`, `zod`, `openai` |
| `store-pilot/package-lock.json` | **Updated** — lockfile |

---

## Verification

Run from `store-pilot/`:

```bash
npm run build
npx vitest run app/routes/__tests__/health.test.ts
```

### Build result (2026-07-09)

```
✓ built in 3.10s
build/server/nodejs_eyJydW50aW1lIjoibm9kZWpzIn0/index.js  1,844 kB
```

### Post-deploy smoke checks

```bash
# Liveness
curl -s -o /dev/null -w "%{http_code}" https://store-pilot-eta.vercel.app/health
# Expected: 200

# Readiness (after env vars + migrations)
curl -s https://store-pilot-eta.vercel.app/health?ready=1

# Worker health (no secret required for GET)
curl -s https://store-pilot-eta.vercel.app/cron/worker
```

---

## Production deployment checklist

1. [ ] Vercel Root Directory = `store-pilot`
2. [ ] All **Required** environment variables set for Production
3. [ ] `SCOPES` matches `shopify.app.toml` (`read_products,read_inventory,write_products,read_orders`)
4. [ ] `SHOPIFY_APP_URL` = `https://store-pilot-eta.vercel.app`
5. [ ] `npx prisma migrate deploy` run against production database
6. [ ] Deploy from `main` branch
7. [ ] Verify `GET /health` returns 200
8. [ ] Verify `GET /health?ready=1` returns 200
9. [ ] Install app on a development store; confirm OAuth redirect works
10. [ ] Configure external `POST /cron/worker` scheduler with `CRON_SECRET`
11. [ ] Run `shopify app deploy` to sync Partner Dashboard URLs and webhooks

---

## Worker cron note

Do **not** rely on Vercel Cron alone for job processing. StorePilot requires:

```
POST /cron/worker
Header: x-cron-secret: <CRON_SECRET>
```

Use GitHub Actions, Supabase `pg_cron` + `pg_net`, or another scheduler. See `store-pilot/docs/F42_WORKER_CRON_DEPLOYMENT.md`.

---

## References

- [React Router on Vercel](https://vercel.com/docs/frameworks/frontend/react-router)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel Headers / Caching](https://vercel.com/docs/edge-network/headers)
- `store-pilot/shopify.app.toml` — production Shopify configuration
- `store-pilot/docs/F42_WORKER_CRON_DEPLOYMENT.md` — background worker setup
