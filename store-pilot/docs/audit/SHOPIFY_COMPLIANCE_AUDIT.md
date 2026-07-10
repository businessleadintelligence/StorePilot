# Shopify Compliance Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## App Store Readiness

Prior documentation exists: `docs/SHOPIFY_APP_STORE_APPROVAL_REPORT.md`, `docs/SHOPIFY_SCOPES_AND_WEBHOOKS.md`, `docs/SHOPIFY_WEBHOOK_COMPATIBILITY_REPORT.md`.

---

## Scopes

**Configured scopes (minimum):**
- `read_products`
- `read_inventory`
- `write_products`
- `read_orders`

**Not requested:** `read_customers`, `read_checkouts`, marketing scopes — **correct for privacy-by-architecture**.

**File:** `shopify.app.toml`

---

## Mandatory Webhooks

| Webhook | Registered | Route | Handler |
|---------|------------|-------|---------|
| `app/uninstalled` | ✅ | `webhooks.app.uninstalled.tsx` | Deactivates store, clears tokens |
| `customers/data_request` | ✅ | `webhooks.customers.data_request.tsx` | Export generation |
| `customers/redact` | ✅ | `webhooks.customers.redact.tsx` | In-place order redaction |
| `shop/redact` | ✅ | `webhooks.shop.redact.tsx` | Store data deletion |

All use `compliance_topics` in TOML — correct Shopify format.

---

## Embedded App Requirements

| Requirement | Status |
|-------------|--------|
| App Bridge embedded | ✅ `AppProvider embedded` |
| Session token auth | ✅ Shopify React Router package |
| HTTPS | ✅ Vercel deployment |
| Billing integration | ✅ `app/billing/` |
| GDPR compliance | ✅ Implemented (with gaps — see GDPR_AUDIT) |

---

## Compliance Gaps

| Gap | Shopify Impact | Priority |
|-----|----------------|----------|
| Incomplete shop/redact deletion | **App review failure risk** if data persists | 🔴 Critical |
| Customer export delivery via log only | Merchant may not receive export within 30 days | 🟠 High |
| Placeholder pages linked from dashboard | Poor review UX | 🟡 Medium |
| `/app/automation` not in nav | Feature discoverability | 🟢 Low |

---

## Billing Compliance

- Shopify billing API via `app/billing/shopify-billing.server.ts`
- Bootstrap subscription on auth
- Usage records tracked in `UsageRecord` model

---

## Score: 86/100

Deduction primarily for shop/redact completeness and export delivery mechanism.
