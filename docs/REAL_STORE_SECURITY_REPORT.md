# StorePilot — Real Store Security Report

**Sprint:** Real Store Validation v1.0  
**Dev store:** `storepilot-dev-1mfgthy7.myshopify.com`  
**Date:** 2026-06-29  
**Overall status:** **PARTIAL** — static/unit checks only; live penetration not performed

---

## Summary

| Control area | Static / unit | Live dev store |
|--------------|---------------|----------------|
| OAuth | ⚠️ PARTIAL | ⏭️ NOT EXECUTED |
| Webhook HMAC | ✅ Unit tests | ⏭️ NOT EXECUTED |
| Secrets encryption | ❌ FAIL locally | ⏭️ NOT EXECUTED |
| Safe logging | ⚠️ UNKNOWN | ⏭️ NOT EXECUTED |
| Privacy-by-Architecture | ⚠️ PARTIAL | ⏭️ NOT EXECUTED |
| GDPR webhooks | ❌ Not in TOML | ⏭️ NOT EXECUTED |
| Cron authentication | ⚠️ Unit tests exist | ⏭️ NOT EXECUTED |
| Authorization / permissions | ⏭️ NOT EXECUTED | — |

---

## OAuth

| Check | Status | Evidence |
|-------|--------|----------|
| Shopify OAuth via App Bridge | ⏭️ NOT EXECUTED | Standard `@shopify/shopify-app-react-router` |
| Google OAuth state signing | 🚫 BLOCKED | Google routes / encryption key not validated |
| OAuth store binding (shop === store record) | ⏭️ NOT EXECUTED | Hardening test may exist in prior branch |
| State replay / expiry | ⏭️ NOT EXECUTED | — |
| Session storage (Prisma) | ⚠️ PARTIAL | `Session` model in schema |

---

## Webhook Verification

| Webhook | HMAC test | Registered TOML | Live delivery |
|---------|-----------|-----------------|---------------|
| `products/create` | ⚠️ | ✅ | ⏭️ |
| `products/update` | ⚠️ | ✅ | ⏭️ |
| `products/delete` | ⚠️ | ✅ | ⏭️ |
| `inventory_levels/update` | ⚠️ | ✅ | ⏭️ |
| `app/uninstalled` | ⚠️ | ✅ | ⏭️ |
| `app/scopes_update` | ⚠️ | ✅ | ⏭️ |
| `orders/*` | ⚠️ | ❌ | ⏭️ |
| `app_subscriptions/update` | ⚠️ | ❌ | ⏭️ |
| GDPR `customers/*`, `shop/redact` | ✅ `f44-gdpr-webhook-routes.test.ts` | ❌ | ⏭️ |

**Finding BUG-006:** GDPR webhooks not registered — App Store compliance risk.

---

## Secrets & Encryption

| Check | Status | Notes |
|-------|--------|-------|
| `TOKEN_ENCRYPTION_KEY` configured | ❌ FAIL | Not in local `.env` |
| Fail-closed on missing key | 🚫 BLOCKED | Cannot boot hardened build |
| Shopify access token encrypted at rest | ⏭️ NOT VERIFIED | `Store.accessToken` field plain string in schema |
| Google/Clarity tokens encrypted | ⏭️ NOT VERIFIED | — |
| `CRON_SECRET` for worker endpoint | ❌ FAIL | Not in local `.env` |

---

## Logging & PII

| Check | Status |
|-------|--------|
| `sanitizeLogContext` / `createSafeLogger` | ⚠️ May exist in untracked hardening files |
| No tokens in logs | ⏭️ NOT EXECUTED — log capture not performed |
| No customer PII in logs | ⚠️ Privacy-by-architecture docs exist |
| Prohibited scopes absent | ⚠️ PARTIAL — `read_orders` missing but no `read_customers` ✅ |

**Configured scopes (no customer PII scopes):**
```
read_products, read_inventory, write_products, write_metaobjects, write_metaobject_definitions
```

---

## Privacy-by-Architecture

| Principle | Status |
|-----------|--------|
| Minimum scopes | ⚠️ DRIFT — missing `read_orders` for orders intelligence |
| No `read_customers` | ✅ |
| GDPR webhook handlers in codebase | ✅ routes exist |
| GDPR webhooks deployed | ❌ BUG-006 |
| Customer data export route | ✅ `app.compliance.customer-export.$exportId.tsx` |

---

## Rate Limits & Authorization

| Check | Status |
|-------|--------|
| Shopify Admin API rate limit handling | ⏭️ NOT EXECUTED live |
| Connector HTTP retry | ⏭️ NOT EXECUTED |
| Cron endpoint rejects unsigned requests | ⚠️ Unit test `f42-cron-worker.test.ts` |
| Admin routes require `authenticate.admin` | ✅ `app.tsx` loader pattern |
| Founder/internal routes gated | ⚠️ `internal.founder.tsx` exists — not tested |

---

## CSP & Security Headers

| Check | Status |
|-------|--------|
| Shopify `boundary.headers()` on app routes | ✅ Pattern in `app.tsx` |
| XSS — server-rendered Polaris web components | ⚠️ Not pen-tested |
| CSRF — Shopify session model | ⚠️ Standard embedded app model |

---

## Security Defects

| ID | Severity | Issue |
|----|----------|-------|
| BUG-006 | Critical | Missing GDPR + billing webhooks in TOML |
| BUG-008 | High | Encryption/cron secrets not configured |
| BUG-001 | Critical | Broken schema prevents security-hardened code paths |

---

## Live Security Tests (Deferred)

The following require a green build and embedded app session:

1. Attempt cron POST without `x-cron-secret` → expect 401
2. Send forged webhook without HMAC → expect 401
3. Replay billing webhook ID → expect idempotent 200
4. Google OAuth with mismatched shop in state → expect rejection
5. Grep production logs for `accessToken`, `authorization`, email patterns → expect zero hits

---

## Conclusion

**Security validation: PARTIAL FAIL.**

Unit-test coverage exists for several controls from prior hardening work, but the current tree cannot demonstrate fail-closed encryption, live webhook security, or GDPR compliance on the development store.

**Do not submit to Shopify App Store** until BUG-006 and BUG-008 are resolved and live security checklist is executed.
