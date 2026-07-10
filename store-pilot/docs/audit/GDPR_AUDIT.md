# GDPR Compliance Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Regulatory Scope

StorePilot processes **order-linked commerce data** on behalf of merchants. It does not maintain a customer database. GDPR obligations arise from:

1. Mandatory Shopify compliance webhooks
2. Merchant staff PII (User, Session)
3. Transient customer ID in export compliance table

---

## Webhook Implementation Status

| Webhook | Handler | Idempotent | HMAC | Tests |
|---------|---------|------------|------|-------|
| `customers/data_request` | `handleCustomersDataRequestWebhook` | ✅ claim pattern | ✅ | ✅ f44 |
| `customers/redact` | `handleCustomersRedactWebhook` | ✅ | ✅ | ✅ f44 |
| `shop/redact` | `handleShopRedactWebhook` | ✅ | ✅ | ✅ f44 |

**File:** `app/services/gdpr.server.ts` (831 lines)

---

## customers/data_request

**Behavior:**
1. Extract customer ID + order GIDs from webhook payload
2. Build export via `gatherCustomerDataExport()`
3. Persist `CustomerDataExport` record
4. Log delivery path `/app/compliance/customer-export/{id}`

**Gap:** No automated notification to merchant. Export must be retrieved via admin UI or ops logs.

**Export contents:** Order financial aggregates, line items — explicitly declares no email/phone/name.

**Route:** `app/routes/app.compliance.customer-export.$exportId.tsx` — requires `authenticate.admin`.

---

## customers/redact

**Behavior:**
- Redacts orders in-place: `orderName → [redacted]`, amounts → 0, line item titles/SKU redacted
- Deletes `CustomerDataExport` rows for customer
- Does **not** delete Order rows (shopifyOrderId retained)

**Assessment:** Partial erasure — order GIDs remain linkable in Shopify admin. May satisfy privacy-by-architecture if no customer identity is stored (legal review recommended).

---

## shop/redact

**Behavior:** `deleteShopDataByDomain()` in transaction + session cleanup.

**Critical Gap:** Deletes only ~19 table types. Does NOT delete intelligence pipeline tables (Evidence, KnowledgeGraph*, HistoricalMemory, RootCause, Prediction, Experiment, DecisionJournal, etc.).

**Failure mode:** `tx.store.delete()` throws FK violation if intelligence data exists → **shop/redact fails silently or returns error to Shopify**.

**Also documented:** Single mega-transaction timeout risk on large stores.

---

## Uninstall vs Redact

| Event | Action | Data Retained |
|-------|--------|---------------|
| `app/uninstalled` | Deactivate store, clear tokens/sessions | All DB data |
| `shop/redact` (~48h later) | Attempt full deletion | Should be zero — currently incomplete |

---

## Recommendations

| Priority | Action | Effort |
|----------|--------|--------|
| 🔴 Critical | Extend `deleteShopDataByDomain()` to delete ALL store-scoped tables in FK-safe order | 3-5 days |
| 🔴 Critical | Add integration test: shop with full intelligence pipeline → shop/redact → zero rows | 2 days |
| 🟠 High | Split shop/redact into batched transactions | 2-3 days |
| 🟠 High | Implement merchant notification for data exports | 2-3 days |
| 🟡 Medium | Add TTL on CustomerDataExport (30 days) | 1 day |
| 🟡 Medium | Consider hard-deleting redacted orders vs in-place anonymization | Legal + 2 days |

---

## Score: 82/100

Webhook registration and handlers are solid. shop/redact completeness is the blocking gap for production GDPR compliance.
