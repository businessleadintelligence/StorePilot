# 13 — Security Certification

**Date:** 2026-07-10  
**Status:** 🟡 **PARTIAL (code audit + tests)**

## Verified (automated / code)

| Control | Status | Evidence |
|---------|--------|----------|
| Webhook HMAC | 🟢 | `validateWebhookRequest` |
| Token encryption | 🟢 | `TOKEN_ENCRYPTION_KEY` + roundtrip in readiness |
| Session storage | 🟢 | Encrypted session storage tests |
| CSRF (Shopify embedded) | 🟢 | App Bridge + Shopify auth |
| SQL injection | 🟢 | Prisma parameterized queries |
| Cross-tenant tests | 🟡 | Partial — f618 high elimination |
| Rate limits | 🟡 | Code exists; prod not load-tested |
| Secrets in repo | 🟢 | No `.env` committed |

## NOT VERIFIED

| Control | Status |
|---------|--------|
| Penetration test | NOT VERIFIED |
| XSS manual review all routes | NOT VERIFIED |
| Prompt injection in prod AI calls | NOT VERIFIED |
| Authorization on all API routes | NOT VERIFIED (manual pass needed) |

## Reference

`docs/audit/` — security-related audits from Phase A/B.

## Certification result

**NOT CERTIFIED** for full production security sign-off.
