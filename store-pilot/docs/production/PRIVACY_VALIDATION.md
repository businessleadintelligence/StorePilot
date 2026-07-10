# Privacy Validation — Phase C (Production Re-Verification)

**Date:** 2026-07-10  
**Prior audit:** `docs/audit/PHASE_B_PRIVACY_SHOPIFY_COMPLIANCE_AUDIT.md`

---

## Scope

Re-verify production posture for PII storage across orders, products, evidence, graph, memory, predictions, experiments, JSON payloads, logs, cache, telemetry, worker payloads.

**Method:** Code/schema review (Phase B) + production readiness checks. **No production DB PII scan executed in Phase C.**

---

## Architecture Posture (Unchanged — Code Review)

| Area | PII risk | Phase B verdict | Phase C change |
|------|----------|-----------------|----------------|
| Order sync fields | Low — no customer name/email/address | OK | None |
| Product/line item text | Watch — merchant free text | OK | None |
| Scopes | Minimum 4 scopes, no customer scopes | OK | ✅ Confirmed in toml |
| Knowledge ingestion GraphQL | No customer fields requested | OK | None |
| JSON evidence/memory columns | Watch — writer guards needed | Partial | Guards implemented Phase B |
| CustomerDataExport | Conditional TTL | Watch | Not prod-tested |
| Token encryption | Required in prod | OK | ✅ Roundtrip passes readiness |

---

## Production-Specific Checks

| Check | Result |
|-------|--------|
| TOKEN_ENCRYPTION_KEY configured | ✅ |
| Prohibited scopes in SCOPES env | ✅ (readiness shopify_scopes ok) |
| privacy-pii-scan cron deployed | ❌ Not in vercel.json |
| GDPR webhooks registered | ✅ shop/redact, customers/redact, customers/data_request |
| Uninstall deactivation | ⚠️ Route gap (see WEBHOOK_VALIDATION.md) |

---

## Uninstall & Redact Flows

| Flow | Code | Prod verified |
|------|------|---------------|
| app/uninstalled | deactivateStore + session delete | ⚠️ Handler gap |
| shop/redact | gdpr.server | ❌ Not live-tested |
| customers/redact | gdpr.server | ❌ Not live-tested |
| Job cancellation on uninstall | cancelStoreJobsOnUninstall | ✅ Code |
| Token clearing | accessToken cleared | ✅ Code |

---

## Issues

### P-1: Production Runtime PII Scan Not Running

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Location** | Cron `privacy-pii-scan` |
| **Root Cause** | Cron not deployed in vercel.json |
| **Evidence** | vercel.json has 5 crons only |
| **Risk** | Accidental PII regression undetected |
| **Recommended Fix** | Add privacy-pii-scan to production crons |
| **Estimated Fix Time** | 30 min |
| **Owner** | DevOps |
| **Verification** | Cron runs; no PII samples in audit log |

### P-2: Uninstall Idempotency Gap

| Field | Value |
|-------|-------|
| **Severity** | High (compliance) |
| **Location** | webhooks.app.uninstalled.tsx |
| **Root Cause** | Skips handleAppUninstalledWebhook idempotency |
| **Evidence** | WEBHOOK_VALIDATION.md |
| **Risk** | Incomplete deletion on retry edge cases |
| **Recommended Fix** | Use service handler |
| **Estimated Fix Time** | 2 hours |
| **Owner** | Backend |

---

## Worker Payloads & Logs

| Check | Result |
|-------|--------|
| Job payloads store PII | ⚠️ Designed for operational IDs only — not prod-audited |
| Structured logging scrubs PII | ✅ logging format server-side |
| Telemetry | ❌ Not verified |

**Conclusion:** Privacy **architecture remains sound**; **production operational verification incomplete**; **uninstall webhook fix required before App Store submission**.
