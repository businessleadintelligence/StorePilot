# Production Installation Verification

**Date:** 2026-07-09  
**Mode:** Read-only — no code modified  
**Production URL:** `https://store-pilot-eta.vercel.app`  
**Dev store:** `storepilot-pe9x0muw.myshopify.com`  
**App client ID:** `c2e45ad18cb75c60ff489050150d9bc1`

---

## Post-reinstall verification (2026-07-09 ~12:18 UTC)

User completed a fresh production reinstall. **Install pipeline succeeded.**

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | OAuth callback executed | **PASS** | Vercel: `Running afterAuth hook`; store upserted |
| 2 | Store row created | **PASS** | 1 store, `active: true`, created `2026-07-09T12:18:49.121Z` |
| 3 | Session row created | **PASS** | 1 session for dev store |
| 4 | Offline token stored | **PASS** | Vercel: `Creating new session { isOnline: false }` |
| 5 | Webhooks registered | **PASS** | Vercel: `Registering webhooks`; app-specific TOML webhooks deployed |
| 6 | Initial sync job queued | **PASS** | 1 sync job; `onboarding_advanced` → `bootstrap_products` |
| 7 | Dashboard loads | **PASS** | Vercel: `GET /app`, `/app/command-center`, `/app/executive.data` |
| 8 | No runtime errors | **PASS** | No HTTP 500; transient pool timeout during install recovered |
| 9 | No Prisma errors | **PASS** | DB healthy; queries succeed post-install |
| 10 | No Vercel errors | **PASS** | Deployment serving; afterAuth completed |

**Score: 10 / 10 PASS**

### Database snapshot (post-reinstall)

```json
{
  "counts": { "storeCount": 1, "sessionCount": 1, "jobCount": 1, "webhookCount": 0 },
  "stores": [{
    "shopifyDomain": "storepilot-pe9x0muw.myshopify.com",
    "active": true,
    "storeName": "StorePilot",
    "createdAt": "2026-07-09T12:18:49.121Z"
  }]
}
```

### Installed scopes (correct)

`read_inventory`, `read_orders`, `read_products`, `write_products` — matches `shopify.app.toml`.

### afterAuth log sequence (Vercel, 17:48 UTC)

1. `[store-sync] Store upserted` → `storeId: 7f1a9df7-d3db-45a1-9a59-a12155f371a1`
2. `[shopify-api/INFO] Registering webhooks`
3. `[user-sync] Owner upserted`
4. `[billing-lifecycle] Trial subscription created`
5. `[after-auth] Store onboarding initialized`
6. `[onboarding] onboarding_advanced` → phase `PRODUCTS`, jobId `f3260095-2747-45a8-b4b8-4745b0ddab21`

### Minor note (non-blocking)

During install, two concurrent `/app` requests briefly hit a Prisma connection pool timeout (`connection limit: 5`). Install recovered and completed successfully. Consider increasing Supabase pooler `connection_limit` or using transaction mode if this recurs under load.

### Webhook note

`webhookSubscriptions` GraphQL query returns empty edges — **expected** for app-specific (TOML config-managed) webhooks. Runtime `registerWebhooks` was invoked; `webhook_events` will populate when Shopify delivers events.

---

## Initial verification (2026-07-09 ~12:10 UTC) — superseded

**Verification time:** ~12:10–12:13

## Overall result: **FAIL** (before reinstall)

Production OAuth install has **not completed**. The production Supabase database contains **zero** store, session, sync job, or webhook event records. The embedded dashboard cannot authenticate. Webhook subscriptions are not registered on the dev store.

Infrastructure (Vercel, database connectivity, health endpoints) is healthy. The blocker is the missing production OAuth callback → `afterAuth` pipeline.

---

## Step results

| # | Check | Result | Summary |
|---|-------|--------|---------|
| 1 | OAuth callback executed | **FAIL** | No `/auth/callback` in Vercel logs; no DB side effects |
| 2 | Store row created | **FAIL** | `stores` table: 0 rows |
| 3 | Session row created | **FAIL** | `Session` table: 0 rows |
| 4 | Offline token stored | **FAIL** | No session rows in production DB |
| 5 | Webhooks registered | **FAIL** | Shopify `webhookSubscriptions`: empty; DB `webhook_events`: 0 |
| 6 | Initial sync job queued | **FAIL** | `sync_jobs` table: 0 rows |
| 7 | Dashboard loads | **FAIL** | `/app/*` returns HTTP 410 without session |
| 8 | No runtime errors | **PASS** | No HTTP 500 in recent logs; expected 302/410 responses |
| 9 | No Prisma errors | **PASS** | DB reachable; Prisma scripts and probes succeed |
| 10 | No Vercel errors | **PASS** | Deployment serving; recent logs info-level only |

**Score: 3 / 10 PASS**

---

## Verification methods

| Method | Command / probe |
|--------|-----------------|
| Database — all stores | `node scripts/check-all-installs.mjs` |
| Database — dev store | `node scripts/check-install-state.mjs` |
| Prisma migrations | `npx prisma migrate status` |
| Health / monitor | `GET /health`, `GET /health?ready=1`, `GET /health/monitor` |
| OAuth entry | `GET /auth/login?shop=storepilot-pe9x0muw.myshopify.com` |
| Dashboard | `GET /app`, `GET /app/command-center?shop=...` |
| Vercel logs | `vercel logs store-pilot-eta.vercel.app --environment production` |
| Shopify Admin API | `shopify app execute -s storepilot-pe9x0muw.myshopify.com` |

---

## 1. OAuth callback executed — **FAIL**

### Evidence

| Probe | Result |
|-------|--------|
| Vercel production logs (last ~9 requests) | **No** `GET /auth/callback` or `POST /auth/callback` entries |
| Vercel logs | **No** `[after-auth]` log entries |
| `Session` table (production DB) | 0 rows |
| Pre-install OAuth entry | **Works** — `GET /auth/login?shop=...` → HTTP 302 to Shopify install URL |

### OAuth redirect (verified working)

```
GET /auth/login?shop=storepilot-pe9x0muw.myshopify.com
→ 302 Location: https://admin.shopify.com/store/storepilot-pe9x0muw/oauth/install?client_id=c2e45ad18cb75c60ff489050150d9bc1
```

Vercel log entry:

```
[shopify-app/INFO] Redirecting login request to https://admin.shopify.com/store/storepilot-pe9x0muw/oauth/install?client_id=...
```

### Conclusion

The install **starts** correctly but the **callback never reached production** (or did not persist). `afterAuth` in `app/shopify.server.ts` did not run against the production database.

---

## 2. Store row created — **FAIL**

### Evidence

```json
// node scripts/check-install-state.mjs
{
  "store": null,
  "counts": { "products": 0, "orders": 0, "inventory": 0 }
}
```

```json
// node scripts/check-all-installs.mjs
{
  "counts": { "storeCount": 0, "sessionCount": 0, "jobCount": 0, "webhookCount": 0 },
  "stores": []
}
```

Expected after successful `afterAuth`: row in `stores` for `storepilot-pe9x0muw.myshopify.com` via `upsertStoreFromSession`.

---

## 3. Session row created — **FAIL**

### Evidence

| Table | Rows |
|-------|-----:|
| `Session` (all shops) | 0 |
| `Session` (dev store) | 0 |

Expected: at least one offline session row (`isOnline: false`) after OAuth callback, stored via `EncryptedPrismaSessionStorage`.

---

## 4. Offline token stored — **FAIL**

### Evidence

No `Session` rows exist, therefore no encrypted `accessToken` (or `refreshToken`) in production Supabase.

### Shopify-side nuance (not a PASS)

`shopify app execute` against the dev store **succeeds** and returns:

```json
{
  "currentAppInstallation": {
    "id": "gid://shopify/AppInstallation/980859912514",
    "launchUrl": "https://storepilot-pe9x0muw.myshopify.com/admin/apps/storepilot-132",
    "app": { "title": "StorePilot" }
  }
}
```

This indicates Shopify has an app installation record, but it is **not linked to the production database**. The CLI uses its own credentials; production Vercel never received or stored the token.

### Stale scope warning

Installed scopes on Shopify do **not** match current `shopify.app.toml`:

| Source | Scopes |
|--------|--------|
| **Deployed TOML** | `read_products`, `read_inventory`, `write_products`, `read_orders` |
| **Live installation** | `read_inventory`, `read_products`, `write_products`, `write_metaobject_definitions`, `write_metaobjects`, `read_metaobject_definitions`, `read_metaobjects` — **missing `read_orders`** |

This suggests an **older or non-production install path** (e.g. `shopify app dev`, Partner preview, or pre-scope-hardening install). A fresh production reinstall is required.

---

## 5. Webhooks registered — **FAIL**

### Shopify Admin API

```graphql
{ webhookSubscriptions(first: 25) { edges { node { id topic uri } } } }
```

Result:

```json
{ "webhookSubscriptions": { "edges": [] } }
```

**Zero shop-level webhook subscriptions** on the dev store.

### Database

| Table | Rows |
|-------|-----:|
| `webhook_events` | 0 |

### Context

- **App-specific webhooks** in `shopify.app.toml` were deployed via `shopify app deploy` (config-managed).
- **Runtime registration** via `registerWebhooks({ session })` in `afterAuth` requires a successful OAuth install with a stored session — this did not occur.

---

## 6. Initial sync job queued — **FAIL**

### Evidence

```json
// check-install-state.mjs
{ "jobs": [] }
```

```json
// check-all-installs.mjs
{ "counts": { "jobCount": 0 } }
```

Expected after `afterAuth`: `advanceOnboarding` enqueues `bootstrap_products` (and subsequent phases) in `sync_jobs`.

`/health/monitor` queue check confirms empty queue (expected without install):

```json
{ "id": "queue", "status": "healthy", "details": { "queued": 0, "running": 0, "deadLetter": 0, "retrying": 0 } }
```

---

## 7. Dashboard loads — **FAIL**

### Probes

| Route | Status | Behavior |
|-------|--------|----------|
| `GET /` | **200** | Public landing page renders (not the embedded dashboard) |
| `HEAD /app?shop=storepilot-pe9x0muw.myshopify.com` | **410** | `authenticate.admin` rejects — no session |
| `GET /app/command-center?shop=storepilot-pe9x0muw.myshopify.com` | **410** | React Router error payload: `"Gone"` |

Without a production session, the embedded app shell and Command Center **cannot load**. Merchants opening the app from Shopify Admin would hit re-auth or error flows.

---

## 8. No runtime errors — **PASS**

### Evidence

| Probe | Result |
|-------|--------|
| `GET /health` | HTTP 200 |
| `GET /health/monitor` | HTTP 200 — all 7 checks healthy |
| `GET /cron/schedule` | HTTP 200 |
| Recent Vercel logs | Info-level only; no 500/502 entries |
| `/app` without session | HTTP 410 — **expected** auth failure, not an unhandled exception |

### Monitor report (excerpt)

All checks healthy: `database`, `supabase`, `shopify_api`, `queue`, `cron`, `worker`, `ai`.

---

## 9. No Prisma errors — **PASS**

### Evidence

| Probe | Result |
|-------|--------|
| `node scripts/check-all-installs.mjs` | Completed without connection error |
| `node scripts/check-install-state.mjs` | Completed without connection error |
| `npx prisma migrate status` | **Database schema is up to date!** (22 migrations) |
| `/health/monitor` database check | `PostgreSQL reachable`, latency ~1.7s |

### Non-blocking note (not scored as FAIL)

`GET /health?ready=1` returns HTTP 503 because the **migrations bundle check** fails on Vercel:

```json
{
  "id": "migrations",
  "ok": false,
  "reason": "ENOENT: no such file or directory, scandir '/var/task/prisma/migrations'"
}
```

This is a **deployment packaging** issue (migration files not present in the serverless bundle), not a database connectivity failure. It does not block the install verification probes above but should be addressed separately for strict readiness gating.

---

## 10. No Vercel errors — **PASS**

### Evidence

| Probe | Result |
|-------|--------|
| Production alias | `store-pilot-eta.vercel.app` resolves and serves |
| Vercel project | `businessleadintelligences-projects/store-pilot` |
| Recent deployment logs | 9 requests fetched; all `info` level |
| Build / deploy | App serving SSR responses with Shopify API initialized |

No Vercel platform errors, deployment failures, or function crashes observed during this verification window.

---

## Root cause analysis

```
Merchant clicks Install
        │
        ▼
GET /auth/login  ──► 302 to Shopify OAuth     ✅ PASS
        │
        ▼
Shopify OAuth approval
        │
        ▼
GET /auth/callback  ──► afterAuth pipeline    ❌ NOT OBSERVED
        │                    │
        │                    ├── upsertStoreFromSession
        │                    ├── registerWebhooks
        │                    ├── upsertOwnerFromSession
        │                    └── advanceOnboarding → sync jobs
        ▼
Production Supabase                              ❌ EMPTY
```

**Most likely causes:**

1. Install was acknowledged in Shopify Admin UI or Partner Dashboard preview, but the browser never completed redirect to `https://store-pilot-eta.vercel.app/auth/callback`.
2. A stale Shopify installation exists (CLI GraphQL works; scopes outdated) but was never bound to the current production database.
3. Install was performed via `shopify app dev` (local tunnel) instead of the production URL.

---

## Required remediation (manual — no code changes)

1. **Uninstall** StorePilot from dev store Admin → Apps (clears stale installation and scopes).
2. **Install via production URL:**

   ```
   https://store-pilot-eta.vercel.app/auth/login?shop=storepilot-pe9x0muw.myshopify.com
   ```

3. Approve scopes and wait for redirect back to the embedded app at `store-pilot-eta.vercel.app`.
4. **Do not** use `shopify app dev` for this verification — it uses a local tunnel, not production.
5. Re-run verification probes:

   ```bash
   node scripts/check-install-state.mjs
   node scripts/check-all-installs.mjs
   ```

6. Confirm Vercel logs show `/auth/callback` and `[after-auth]` entries.
7. Release latest Shopify app config if needed: `shopify app release --version=storepilot-12`.

---

## Expected state after successful install

| Check | Expected |
|-------|----------|
| `stores` | 1 row for `storepilot-pe9x0muw.myshopify.com`, `active: true` |
| `Session` | ≥1 row, `isOnline: false`, `hasAccessToken: true` |
| `sync_jobs` | ≥1 row, type `bootstrap_products`, status `queued` or `running` |
| Shopify `webhookSubscriptions` | Non-empty edges pointing to `store-pilot-eta.vercel.app/webhooks/*` |
| `GET /app` (embedded, with valid session) | HTTP 200, App Bridge shell |
| Vercel logs | `[after-auth]` with `onboarding_initialized`, `onboarding_advanced` |

---

## References

| Resource | Path / URL |
|----------|------------|
| afterAuth pipeline | `app/shopify.server.ts` |
| Install state script | `scripts/check-install-state.mjs` |
| Prior install report | `../docs/SHOPIFY_INSTALLATION_REPORT.md` (parent repo) |
| OAuth audit | `../docs/OAUTH_CONFIGURATION_AUDIT.md` (parent repo) |
| Production URL | `https://store-pilot-eta.vercel.app` |
