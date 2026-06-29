# StorePilot — Real Store Connector Report

**Sprint:** Real Store Validation v1.0  
**Dev store:** `storepilot-dev-1mfgthy7.myshopify.com`  
**Date:** 2026-06-29  
**Overall status:** **NOT VALIDATED**

---

## Executive Summary

No connector integration was exercised against the Shopify Development Store. The current working tree lacks a complete connector platform schema, connector settings UI routes, and required environment credentials.

---

## Connector Inventory (Codebase vs Runtime)

| Connector | Code present | Route/UI | Schema | Real-store test |
|-----------|--------------|----------|--------|-----------------|
| Google Analytics 4 | ⚠️ Partial (`Store.ga4*` fields) | ❌ | ⚠️ Inline on Store, not `GoogleIntegration` table | ⏭️ NOT EXECUTED |
| Google Search Console | ❌ Not in active schema | ❌ | ❌ | ⏭️ NOT EXECUTED |
| PageSpeed Insights | ❌ | ❌ | ❌ | ⏭️ NOT EXECUTED |
| Microsoft Clarity | ❌ Not in active schema | ❌ | ❌ | ⏭️ NOT EXECUTED |

**Note:** Migrations exist for richer connector models in repo history (`20260628120000_add_ai_platform_v2`, Clarity migration referenced in prior hardening work) but current `schema.prisma` does not include them.

---

## Test Matrix

### Google Analytics

| Scenario | Status | Notes |
|----------|--------|-------|
| OAuth start | ⏭️ NOT EXECUTED | `GOOGLE_CLIENT_ID` / `SECRET` not in local `.env` |
| OAuth callback | ⏭️ NOT EXECUTED | `auth.google.callback` route status unknown in active routes |
| Token storage (encrypted) | 🚫 BLOCKED | `TOKEN_ENCRYPTION_KEY` missing locally |
| Refresh token rotation | ⏭️ NOT EXECUTED | — |
| Reconnect | ⏭️ NOT EXECUTED | — |
| Disconnect | ⏭️ NOT EXECUTED | — |
| Permission revocation handling | ⏭️ NOT EXECUTED | — |
| Expired token retry | ⏭️ NOT EXECUTED | — |
| HTTP retry on 429/5xx | ⚠️ PARTIAL | `google-http.ts` may exist in untracked tree — not validated live |
| Sync to UnifiedStoreMetrics | 🚫 BLOCKED | Connector engine not routable |
| Connector cache | ⏭️ NOT EXECUTED | — |

### Google Search Console

All scenarios **⏭️ NOT EXECUTED** — integration not active in current schema.

### PageSpeed Insights

All scenarios **⏭️ NOT EXECUTED**.

### Microsoft Clarity

All scenarios **⏭️ NOT EXECUTED**.

---

## UnifiedStoreMetrics

| Check | Status |
|-------|--------|
| Metrics aggregation from connectors | 🚫 BLOCKED |
| Missing connector graceful degradation | ⏭️ NOT EXECUTED |
| Skipped connector handling | ⏭️ NOT EXECUTED |
| Reconnect-later flow | ⏭️ NOT EXECUTED |

---

## Data Quality & System Health

| Check | Status |
|-------|--------|
| Data quality score | ⏭️ NOT EXECUTED |
| Connector freshness warnings | ⏭️ NOT EXECUTED |
| System Health connector panel | 🚫 BLOCKED — route missing |
| Production Health subsystem | 🚫 BLOCKED |

---

## Isolation

| Requirement | Status |
|-------------|--------|
| Connector failure does not block others | ⏭️ NOT EXECUTED on live store |
| Unit test coverage for isolation | ⚠️ UNKNOWN — connector platform tests not run (suite failing) |

---

## Environment Requirements (Not Met)

```env
GOOGLE_CLIENT_ID=        # missing
GOOGLE_CLIENT_SECRET=    # missing
TOKEN_ENCRYPTION_KEY=    # missing
# Clarity API credentials — not configured
```

---

## Defects

| ID | Issue |
|----|-------|
| BUG-001 | Schema missing connector integration tables |
| BUG-004 | Settings/connectors UI routes missing |
| BUG-008 | Encryption key not configured |

---

## Recommended Re-validation Steps

1. Restore full connector schema + migrations
2. Configure Google Cloud OAuth consent for dev store redirect URL
3. In embedded app → Settings → connect GA4, GSC, PageSpeed
4. Connect Microsoft Clarity project token
5. Trigger manual sync; verify UnifiedStoreMetrics + System Health scores update
6. Revoke Google permission externally; verify reconnect prompt
7. Document sync duration and error recovery per connector

---

## Conclusion

**Connector validation: FAIL.** Zero real OAuth or sync flows completed.
