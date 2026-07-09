# StorePilot — Production Security Audit

**Sprint:** 9 — Security  
**Date:** 2026-07-09  
**Scope:** `store-pilot/` production deployment  
**Method:** Static code review + automated test verification

---

## Executive summary

| Area | Rating | Status |
|------|--------|--------|
| OAuth (Shopify) | Strong | Pass |
| OAuth (Google) | Good | Pass |
| Webhook signatures | Strong | Pass |
| CSP | Adequate | Pass (SDK-managed) |
| Security headers | Good | Pass |
| Cookies / sessions | Good | Pass |
| CSRF | Adequate | Pass (embedded app model) |
| Rate limiting | Weak | Gap — outbound only |
| Secrets | Good | Pass |
| Environment variables | Good | Pass |
| Shopify compliance | Good | Pass |
| GDPR | Good | **Fixed** (shop/redact) |

**Production-critical fix applied:** `shop/redact` now deletes integrations, AI tables, and all FK-restricted child records before store removal (`app/services/gdpr.server.ts`).

---

## 1. OAuth

### Shopify OAuth

| Control | Implementation | File |
|---------|----------------|------|
| Official SDK | `@shopify/shopify-app-react-router` | `app/shopify.server.ts` |
| App Store distribution | `AppDistribution.AppStore` | `app/shopify.server.ts` |
| Expiring offline tokens | `expiringOfflineAccessTokens: true` | `app/shopify.server.ts` |
| Encrypted session storage | AES-256-GCM via `EncryptedPrismaSessionStorage` | `app/services/encrypted-session-storage.server.ts` |
| Auth on `/app/*` | `authenticate.admin(request)` | `app/routes/app.tsx` |

**Verdict:** Pass. Shopify OAuth follows platform best practices with encrypted token storage and session-based admin authentication.

### Google OAuth

| Control | Implementation | File |
|---------|----------------|------|
| HMAC-signed state | SHA-256 HMAC with TTL (15 min) | `app/google/oauth/google-oauth.service.ts` |
| Store binding | Callback verifies shop domain matches store | `app/services/google-integration.server.ts` |
| Encrypted tokens | `encryptSecretToken` on refresh/access tokens | `app/google/oauth/google-token.service.ts` |
| Initiation gated | Requires `authenticate.admin` | `app/routes/app.settings.tsx` |

**Gaps (non-critical):**

- Google OAuth state signing falls back to `SHOPIFY_API_SECRET` when `TOKEN_ENCRYPTION_KEY` is unset.
- Callback route (`/auth/google/callback`) is unauthenticated by design; mitigated by signed state.

**Verdict:** Pass with minor hardening opportunities.

---

## 2. Webhook signatures

| Control | Implementation | File |
|---------|----------------|------|
| Central HMAC validation | `validateWebhookRequest()` | `app/shopify.server.ts` |
| Invalid HMAC → 401 | `WebhookValidationErrorReason.InvalidHmac` | `app/shopify.server.ts` |
| POST-only | Returns 405 for non-POST | `app/shopify.server.ts` |
| Idempotency | `claimWebhookEvent` / lease claiming | `app/services/webhook.server.ts` |
| Test coverage | HMAC failure propagation | `app/routes/__tests__/f44-gdpr-webhook-routes.test.ts` |

**Webhook routes using `validateWebhookRequest`:** 12 of 13 routes.

**Exception:** `webhooks.app.scopes_update.tsx` uses `authenticate.webhook()` — also validates HMAC via Shopify SDK, but uses a different code path.

**Verdict:** Pass.

---

## 3. Content-Security-Policy (CSP)

| Control | Implementation | File |
|---------|----------------|------|
| Embedded app CSP | `addDocumentResponseHeaders` (Shopify SDK) | `app/entry.server.tsx` |
| Route boundary headers | `boundary.headers(headersArgs)` | `app/routes/app.tsx` |
| `frame-ancestors` | Set by SDK for `admin.shopify.com` | Delegated to Shopify |

**Gaps (non-critical):**

- No explicit CSP in `vercel.json` — relies on Shopify SDK for embedded routes.
- `root.tsx` error boundary does not apply `boundary.headers`.
- Non-embedded routes (health, webhooks, cron) receive only global headers from `vercel.json`.

**Verdict:** Adequate for Shopify embedded app model. CSP is correctly delegated to the Shopify App Bridge SDK.

---

## 4. Security headers

Configured in `store-pilot/vercel.json`:

| Header | Value | Scope |
|--------|-------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | All routes |
| `X-Content-Type-Options` | `nosniff` | All routes |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | All routes |
| `X-DNS-Prefetch-Control` | `on` | All routes |
| `Cache-Control` | `no-store` | `/health` |
| `Cache-Control` | `public, max-age=31536000, immutable` | `/assets/*` |

**Gaps (non-critical):**

- No `Permissions-Policy` header.
- No `X-Frame-Options` (CSP `frame-ancestors` from Shopify SDK covers embedded routes).

**Verdict:** Pass.

---

## 5. Cookies

| Control | Implementation |
|---------|----------------|
| Session management | Shopify App library (no custom cookie code) |
| Token storage | PostgreSQL `Session` table, not client cookies |
| Encryption at rest | Access/refresh tokens encrypted via `token-crypto.server.ts` |

Cookie attributes (`HttpOnly`, `Secure`, `SameSite`) are managed by the Shopify App SDK defaults.

**Verdict:** Pass (SDK-managed).

---

## 6. Sessions

| Control | Implementation | File |
|---------|----------------|------|
| Prisma Session model | `expires`, `refreshToken`, `refreshTokenExpires` | `prisma/schema.prisma` |
| Encrypted storage | `EncryptedPrismaSessionStorage` | `app/services/encrypted-session-storage.server.ts` |
| Expired session cleanup | Hourly cron | `app/services/cron-jobs.server.ts` |
| Uninstall cleanup | Sessions deleted on `app/uninstalled` | `app/routes/webhooks.app.uninstalled.tsx` |
| Shop redact cleanup | Sessions deleted on `shop/redact` | `app/services/gdpr.server.ts` |

**Verdict:** Pass.

---

## 7. CSRF

| Surface | Protection |
|---------|------------|
| `/app/*` routes | `authenticate.admin` — Shopify session token validation |
| Webhook routes | POST + HMAC (not browser-callable) |
| Cron routes | `CRON_SECRET` bearer/header auth |
| Google OAuth callback | HMAC-signed state parameter |

StorePilot is a Shopify embedded app. CSRF protection relies on Shopify App Bridge session tokens rather than explicit CSRF tokens — the standard pattern for this app type.

**Verdict:** Adequate for embedded Shopify apps.

---

## 8. Rate limiting

| Type | Status | File |
|------|--------|------|
| Outbound Google API | In-memory 60 req/min | `app/google/shared/google-rate-limit.ts` |
| Outbound Shopify GraphQL | 429 retry with backoff | `app/shopify-automation/shopify-rate-limit.ts` |
| HTTP ingress | **Not implemented** | — |

**Gap:** No IP-based or route-level rate limiting on webhooks, auth, health, or app endpoints. Invalid webhook requests still consume compute (HMAC rejects them, but request is processed).

**Recommendation:** Add Vercel WAF rules or edge middleware for `/webhooks/*` and `/auth/*`.

**Verdict:** Weak — documented gap, not production-blocking for initial launch.

---

## 9. Secrets

| Secret | Usage | Protection |
|--------|-------|------------|
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM for tokens/sessions | Fails closed on encrypt |
| `CRON_SECRET` | Cron/worker auth | Timing-safe compare |
| `SHOPIFY_API_SECRET` | Webhook HMAC, OAuth | Env-only, not logged |
| `DATABASE_URL` | Prisma connection | Env-only |
| `OPENAI_API_KEY` | AI provider | Env-only, redacted in logs |

| Control | Implementation | File |
|---------|----------------|------|
| AES-256-GCM encryption | Random IV + auth tag | `app/services/token-crypto.server.ts` |
| Timing-safe comparison | `secureCompareStrings` | `app/lib/secure-compare.server.ts` |
| Log redaction | Recursive PII/secret stripping | `app/lib/logging/redaction.server.ts` |
| GDPR log sanitization | Hashed customer IDs | `app/lib/privacy-by-architecture.ts` |

**Gaps (non-critical):**

- `decryptSecretToken` returns plaintext for values without `spenc:v1:` prefix (legacy migration compat).
- `assertTokenEncryptionConfigured()` not called at HTTP boot.

**Verdict:** Pass.

---

## 10. Environment variables

| Control | Implementation | File |
|---------|----------------|------|
| Startup readiness | 5 critical checks + scope validation | `app/services/startup-readiness.server.ts` |
| Production validation | 4 required vars | `app/production/production-security.ts` |
| Worker gate | `assertStartupReadiness()` before cycles | `app/services/worker.server.ts` |
| Full catalog | 38 variables documented | `docs/ENVIRONMENT_VARIABLES.md` |

**Required for production:**

```
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL
DATABASE_URL
TOKEN_ENCRYPTION_KEY
CRON_SECRET
SCOPES
```

**Gaps (non-critical):**

- No fail-fast at HTTP server boot — misconfigured deploy serves traffic until `/health/ready` returns 503.
- `GOOGLE_CLIENT_ID/SECRET` and AI vars validated at runtime only.

**Verdict:** Pass.

---

## 11. Shopify compliance

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Mandatory GDPR webhooks | Registered | `shopify.app.toml` |
| `customers/data_request` | Implemented | `app/routes/webhooks.customers.data_request.tsx` |
| `customers/redact` | Implemented | `app/routes/webhooks.customers.redact.tsx` |
| `shop/redact` | Implemented + fixed | `app/routes/webhooks.shop.redact.tsx` |
| `app/uninstalled` | Implemented | `app/routes/webhooks.app.uninstalled.tsx` |
| Privacy-by-architecture | No customer PII scopes | `app/lib/privacy-by-architecture.ts` |
| Minimum scopes only | `read_products,read_inventory,write_products,read_orders` | `shopify.app.toml` |
| Prohibited scopes blocked | Startup validation | `app/services/startup-readiness.server.ts` |

**Verdict:** Pass.

---

## 12. GDPR

| Flow | Implementation | File |
|------|----------------|------|
| Customer data request | Scoped export, idempotent | `app/services/gdpr.server.ts` |
| Customer redact | Order/line-item redaction | `app/services/gdpr.server.ts` |
| Shop redact | Full store deletion | `app/services/gdpr.server.ts` |
| Export download | `authenticate.admin` + store scoping | `app/routes/app.compliance.customer-export.$exportId.tsx` |
| No customer PII stored | Privacy-by-architecture | `app/lib/privacy-by-architecture.ts` |

### Production-critical fix (Sprint 9)

**Issue:** `deleteShopDataByDomain()` did not delete FK-restricted child tables before `store.delete()`. Stores with Google/Clarity integrations or AI data would fail shop/redact with FK violations, leaving encrypted tokens and AI data in the database.

**Fix:** Delete all restricted children in transaction order:

```
aiRecommendation → aiResultCacheEntry → aiAgentResult → aiAgentRun
→ aiMemoryRecord → googleIntegration → microsoftClarityIntegration
→ customerDataExport → (existing store children) → store
```

**Test:** `app/services/__tests__/f44-gdpr-webhooks.test.ts` — "3b. deletes integrations and AI data on shop redact"

**Verdict:** Pass (after fix).

---

## Public endpoint exposure

| Endpoint | Auth | Risk |
|----------|------|------|
| `GET /health`, `/health/live` | None | Low — liveness only |
| `GET /health/ready` | None | Medium — exposes failed check IDs |
| `GET /health/monitor` | None | Medium — exposes subsystem details |
| `GET /cron/schedule` | None | Low — schedule paths (documented) |
| `GET /cron/worker` | None | Low — queue config status |

These are intentional for uptime monitoring (see `docs/MONITORING_SETUP.md`). `/health/ready` and `/health/monitor` should be restricted via Vercel deployment protection or a future `MONITOR_SECRET` in a follow-up sprint.

---

## Production-critical issues

| Priority | Issue | Status |
|----------|-------|--------|
| **P0** | Shop/redact incomplete deletion (integrations, AI tables) | **Fixed** |
| P1 | No HTTP ingress rate limiting | Documented — future sprint |
| P1 | Public readiness/monitor detail exposure | Documented — accept or add `MONITOR_SECRET` |
| P2 | `decryptSecretToken` plaintext fallback | Documented — migration audit needed |
| P2 | CSP not verified outside Shopify SDK | Acceptable for embedded app |
| P3 | `scopes_update` uses alternate webhook validation | Low risk — SDK validates HMAC |

---

## Verification

```bash
cd store-pilot

# GDPR + security-related tests
npm test -- f44-gdpr gdpr-webhook privacy-by-architecture f42-cron-worker

# Full suite
npm test

# Typecheck + build
npm run typecheck
npm run build
```

### Pre-deploy checklist

- [ ] `TOKEN_ENCRYPTION_KEY` set in Vercel (32+ char random string)
- [ ] `CRON_SECRET` set in Vercel (32+ char random string)
- [ ] `SCOPES` matches `shopify.app.toml`
- [ ] `SHOPIFY_APP_URL` matches Vercel production domain
- [ ] No secrets in git (`.env` untracked)
- [ ] Supabase RLS / network restrictions configured
- [ ] Shopify mandatory webhooks registered (verify via Partner Dashboard)

---

## Related documentation

| Document | Content |
|----------|---------|
| `docs/ENVIRONMENT_VARIABLES.md` | Full env var catalog |
| `docs/MONITORING_SETUP.md` | Health endpoint reference |
| `docs/CRON_SCHEDULE.md` | Cron auth and scheduling |
| `docs/LOGGING_ARCHITECTURE.md` | PII redaction in logs |
| `docs/BACKUP_AND_RECOVERY.md` | Data recovery procedures |
| `docs/SHOPIFY_SCOPES_AND_WEBHOOKS.md` | Scope and webhook policy |
