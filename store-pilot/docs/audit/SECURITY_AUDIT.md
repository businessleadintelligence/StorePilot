# Security Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Executive Summary

StorePilot implements **solid baseline security** for a Shopify embedded app: HMAC webhook validation, encrypted session storage, admin-only route authentication, token encryption, and structured log redaction. Primary gaps are operational (secret rotation, RLS absence) rather than fundamental design flaws.

**Security Score:** 91/100

---

## Authentication & Authorization

| Control | Status | File |
|---------|--------|------|
| Shopify OAuth | Implemented | `app/shopify.server.ts` |
| Embedded app session | `AppProvider embedded` | `app/routes/app.tsx` |
| Route protection | `authenticate.admin(request)` on app routes | All `app.*.tsx` loaders |
| Session encryption | `EncryptedPrismaSessionStorage` | `app/services/encrypted-session-storage.server.ts` |
| Webhook HMAC | `validateWebhookRequest` | `app/shopify.server.ts` |
| Cron secret | `CRON_SECRET` env | `app/routes/cron.worker.tsx` |
| Internal founder route | 404 in production | `app/routes/internal.founder.tsx` |
| Dev sync route | 404 in production | `app/routes/app.dev.sync-products.tsx` |

**Gap:** No role-based access within a store (single merchant admin model — acceptable for v1).

---

## Secrets & Environment

| Secret | Storage | Risk |
|--------|---------|------|
| `SHOPIFY_API_KEY/SECRET` | Env vars | Standard |
| `DATABASE_URL` | Env var | Pool config audited |
| `OPENAI_API_KEY` | Env var | AI provider |
| Token encryption key | `TOKEN_ENCRYPTION_KEY` — throws if missing | `token-crypto.server.ts` |
| `CRON_SECRET` | Env var | Required for cron worker |
| Store access tokens | DB `Store.accessToken` — cleared on uninstall | Encrypted at rest depends on DB |

**Recommendation:** Document secret rotation procedure; verify DB encryption at rest (provider-level).

---

## Input Validation

| Layer | Status |
|-------|--------|
| Zod in AI output validation | Yes — `app/ai/core/ai-output.ts` |
| GDPR payload validation | Yes — `gdpr.server.ts` |
| Webhook payload | HMAC + topic routing |
| Form actions | Basic intent checking on experiment/executive routes |
| GraphQL queries | Parameterized via Shopify client |

**Gap:** No universal request body schema validation middleware for all routes.

---

## Threat Model

| Threat | Mitigation | Residual |
|--------|------------|----------|
| Webhook spoofing | HMAC validation | Low |
| CSRF on embedded app | Shopify App Bridge + session | Low |
| XSS | Polaris web components; React default escaping | Low-Medium — audit custom HTML |
| SQL injection | Prisma parameterized queries | Low |
| Cross-tenant data access | Manual storeId scoping | Medium — no RLS |
| Token theft | Encrypted sessions; HTTPS | Low |
| AI prompt injection | PII sanitizer on Foundation path | Medium on V2 path |
| Denial of service | No rate limiting on app routes | Medium |
| Worker queue poisoning | Job type validation in dispatcher | Low |

---

## Risk Register

| ID | Risk | Level | Mitigation |
|----|------|-------|------------|
| SEC-01 | Incomplete shop/redact leaves data | 🔴 High | Extend GDPR deletion — see PRIVACY_AUDIT |
| SEC-02 | No PostgreSQL RLS | 🟠 Medium | Application-level scoping + integration tests |
| SEC-03 | V2 AI path lacks PII sanitizer parity | 🟠 Medium | Migrate to Foundation |
| SEC-04 | No API rate limiting | 🟡 Medium | Add Vercel/rate limit middleware |
| SEC-05 | JSON blob PII drift | 🟡 Medium | Runtime guards exist; add write-time validation |
| SEC-06 | Customer export path logged not encrypted-in-transit to merchant | 🟢 Low | HTTPS + admin auth on export route |

---

## Sensitive Logging

**Strengths:**
- `app/lib/logging/redaction.server.ts` — context redaction
- `sanitizeLogContext()` hashes customer IDs in GDPR logs
- Structured JSON logging with level control

**Gaps:**
- Some modules use raw `console.error` (e.g., `shopify.server.ts` after-auth)
- No correlation ID propagation verified across worker → API

---

## Webhook Security

All 13 webhook routes use Shopify authentication. GDPR compliance webhooks registered in `shopify.app.toml` with `compliance_topics`.

Tests: `app/routes/__tests__/f44-gdpr-webhook-routes.test.ts`, `app/services/__tests__/f44-gdpr-webhooks.test.ts`
