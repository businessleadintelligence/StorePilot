# 14 — Privacy Certification

**Date:** 2026-07-10  
**Status:** 🟡 **PARTIAL**

## Phase B baseline

Reference: `docs/audit/PHASE_B_PRIVACY_SHOPIFY_COMPLIANCE_AUDIT.md`

## Automated guards (local)

| Guard | Status | Evidence |
|-------|--------|----------|
| `json-pii-guard.server.ts` | 🟢 | Implemented |
| `privacy-hardening.test.ts` | 🟢 | 7 tests pass |
| Prohibited field names | 🟢 | `privacy-by-architecture.ts` |
| Order metrics exclude redacted | 🟢 | `order-query-filters.server.ts` |
| Session PII strip | 🟢 | `merchant-identity.server.ts` |
| GDPR store deletion tests | 🟢 | `gdpr-store-deletion.test.ts` |

## New intelligence modules — static scan (2026-07-10)

| Module | Customer email/phone fields in code | Persisted payload test |
|--------|--------------------------------------|------------------------|
| Executive Decision Engine | None found | NOT VERIFIED |
| Root Cause Engine | `customerImpact` (numeric score only) | NOT VERIFIED |
| Prediction Engine | None found | NOT VERIFIED |
| Experiment Intelligence | None found | NOT VERIFIED |
| Merchant Intelligence | None found | NOT VERIFIED |
| Intelligence Workspaces | Not scanned end-to-end | NOT VERIFIED |
| Adaptive Intelligence | Not scanned end-to-end | NOT VERIFIED |

## GDPR webhooks — NOT VERIFIED in production

| Webhook | Status |
|---------|--------|
| `shop/redact` | NOT VERIFIED live |
| `customers/redact` | NOT VERIFIED live |
| `customers/data_request` | NOT VERIFIED live |

## Phase A blocker (may be addressed locally)

`deleteShopDataByDomain()` completeness — verify against current `gdpr-store-deletion.server.ts` before sign-off.

## Required human action

1. Run GDPR webhook tests in Partner Dashboard
2. Add persisted-payload PII scans per intelligence module
3. DB audit on fresh store JSON columns

## Certification result

**NOT CERTIFIED**
