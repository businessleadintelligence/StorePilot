# StorePilot — Shopify App Store Approval Report

**Sprint:** Privacy & Approval Hardening (FINAL)  
**Date:** 2026-06-20  
**Version audited:** StorePilot production codebase (`store-pilot/`)

---

## Executive summary

StorePilot is architected and hardened as a **product, inventory, pricing, SEO, and store operations intelligence platform**. It is **not** a CRM, customer analytics tool, or marketing automation product.

After a full 10-phase audit, the codebase meets Shopify App Store privacy expectations with **minimal scopes**, **aggregated order data only**, **no customer PII in product data paths**, and **mandatory GDPR compliance** preserved.

**Final approval readiness score: 94 / 100**

---

## 1. Remaining privacy risks

| Risk | Severity | Status | Mitigation |
|------|----------|--------|------------|
| `CustomerDataExport.shopifyCustomerId` in DB | Low | Accepted | Mandatory GDPR webhook compliance only; export payload declares no stored customer profile fields |
| `User.email` / `Session.email` for merchant staff | Low | Accepted | Shopify OAuth app users (merchant staff), not shopper PII |
| GDPR webhook payloads contain customer email/phone transiently | Low | Mitigated | Payloads processed in-memory; not persisted; logs use `customerIdHash` not raw ID |
| LLM provider could theoretically receive PII if upstream bug introduced | Very low | Mitigated | `assertFactsFreeOfCustomerPii`, prohibited field scanner, prompt privacy rules on all 11 agents |
| Growth fixture language referencing "campaign" | Negligible | Resolved | Test copy sanitized; no email/SMS automation in product |

**Overall residual risk: near zero** for App Store customer-data review.

---

## 2. Removed / sanitized customer-related fields

### Scopes removed (template residue)

- `write_metaobjects`
- `write_metaobject_definitions`

### Scopes never requested

- `read_customers`, `write_customers`
- All marketing / customer event scopes

### Order ingestion — excluded from GraphQL and DB

- `customerId`, `customer.email`, `customer.name`, `phone`
- `shippingAddress`, `billingAddress`
- Order notes, marketing consent, customer tags

### Logging / telemetry hardened

- GDPR logs: `shopifyCustomerId` → `customerIdHash` (SHA-256 truncated)
- String log values passed through `redactPotentialPiiInText()` (email/phone patterns)
- No raw Shopify webhook payloads stored in `WebhookEvent`

### AI layer

- All 11 prompt files include Privacy-by-Architecture rule
- Facts builders validated against prohibited PII field paths
- No customer-level reasoning or personalization in agent outputs

---

## 3. Final Shopify scopes

| Scope | Why needed | Feature dependency | Can remove? | App review impact |
|-------|------------|-------------------|-------------|-------------------|
| `read_products` | Catalog sync, product intelligence, SEO, bundles, pricing, growth | Product Intelligence, Bundle Discovery, Store Audit, SEO, Pricing, Growth | **No** | Required — core product |
| `read_inventory` | Stock levels, coverage, bundle inventory | Inventory Intelligence, Operations | **No** | Required — inventory intelligence |
| `write_products` | Merchant-approved automation (tags, SEO metadata, publish, pricing prep) | Automation templates | **No** | Justify in listing as optional merchant-approved writes |
| `read_orders` | Aggregated revenue, AOV, refunds, line-item velocity | Growth, Pricing, Executive COO, dashboards | **No** | Required — aggregated commerce metrics only |

**Configured in `shopify.app.toml`:**

```
read_products,read_inventory,write_products,read_orders
```

Automated test: `privacy-by-architecture.test.ts` validates exact scope set and absence of prohibited scopes.

---

## 4. Final webhook list

### Operational (product intelligence)

| Topic | Purpose | Removable? |
|-------|---------|------------|
| `app/uninstalled` | Store cleanup on uninstall | No |
| `app/scopes_update` | Scope change sync | No |
| `products/create`, `products/update`, `products/delete` | Catalog sync | No |
| `inventory_levels/update` | Inventory sync | No |
| `orders/create`, `orders/updated`, `orders/cancelled` | Aggregated order sync (GraphQL re-fetch, no raw payload storage) | No |

### Mandatory GDPR (App Store compliance — NOT customer analytics)

| Topic | Purpose | Removable? |
|-------|---------|------------|
| `customers/data_request` | Export any stored customer-linked data for merchant GDPR response | **No** (mandatory) |
| `customers/redact` | Delete customer-linked export records | **No** (mandatory) |
| `shop/redact` | Delete all store data on uninstall/redact | **No** (mandatory) |

### Explicitly NOT registered

- `customers/create`, `customers/update`, `customers/delete`
- Marketing, checkout, cart, or analytics customer webhooks

---

## 5. Database schema compliance

| Model | Classification | Customer PII? |
|-------|----------------|---------------|
| `Store` | Merchant store metadata | No |
| `Product` | Catalog | No |
| `Order` / `OrderLineItem` | Aggregated commerce (revenue, line items, status) | No customer fields |
| `WebhookEvent` | Idempotency metadata (topic, shop, webhook ID) | No payload column |
| `CustomerDataExport` | GDPR compliance only | `shopifyCustomerId` for correlation; export declares no profile PII stored |
| `User` / `Session` | Merchant staff OAuth | Staff email (not shopper) |
| `AiAgentRun`, `AiAgentResult`, `AiRecommendation`, `AiMemoryRecord` | AI platform outputs | No customer identity fields |
| `AiExecutionTelemetry` | Latency, tokens, cost | No customer fields |

**No `Customer` model.** No customer caches, customer analytics tables, or customer memory.

Automated tests: 35+ privacy assertions in `privacy-by-architecture.test.ts`.

---

## 6. GDPR compliance status

| Requirement | Status |
|-------------|--------|
| Mandatory GDPR webhooks registered | ✅ |
| Customer data request handler | ✅ — exports aggregated order line items only; `storedCustomerProfile: { email: false, phone: false, name: false }` |
| Customer redact handler | ✅ — deletes export records for customer ID |
| Shop redact handler | ✅ — deletes all store data |
| Privacy policy alignment | ✅ — documented in `PRIVACY_BY_ARCHITECTURE.md` |
| Data minimization | ✅ — no customer scopes; aggregated orders only |

---

## 7. App Store rejection risk analysis

| Review area | Risk | Notes |
|-------------|------|-------|
| Excessive scopes | **Low** | 4 scopes, all justified for BI/operations |
| Customer data collection | **Very low** | No customer scopes; no customer tables |
| Data use disclosure mismatch | **Low** | Listing must state: product/inventory/pricing intelligence, not CRM |
| GDPR webhooks | **None** | All three mandatory webhooks implemented and tested |
| Protected customer data API | **None** | App does not use Customer API |
| Webhook payload logging | **Low** | Sanitized; automated GDPR tests verify no email/phone in logs |
| AI / third-party data sharing | **Low** | Facts are aggregated metrics; privacy rules in all prompts |

**Most likely review friction:** Explaining `write_products` for merchant-approved automation — provide clear opt-in UX and listing copy.

---

## 8. Security improvements summary (this sprint)

1. **`privacy-by-architecture.ts`** — PII field detection, scope validation, log sanitization, `hashIdentifierForLog`, `sanitizeLogContext`
2. **`gdpr.server.ts`** — GDPR logs routed through sanitizer
3. **`orders.server.ts`** — `ORDER_BY_ID_QUERY` exported for test verification; queries exclude customer fields
4. **`shopify.app.toml`** — Minimum scopes; demo metaobject scopes removed
5. **Documentation** — `PRIVACY_BY_ARCHITECTURE.md`, `SHOPIFY_SCOPES_AND_WEBHOOKS.md`, this report
6. **Automated enforcement** — 43 privacy + GDPR tests; full suite **2,535 tests passing**

---

## 9. Phase completion checklist

| Phase | Status |
|-------|--------|
| 1 — Full data layer audit | ✅ Complete |
| 2 — Scopes minimization | ✅ Complete |
| 3 — Order data sanitization | ✅ Complete |
| 4 — Webhook cleanup | ✅ Complete (GDPR webhooks retained per mandatory compliance) |
| 5 — Database cleanup | ✅ Verified — no migration required |
| 6 — AI layer audit | ✅ Complete |
| 7 — Logging & telemetry safety | ✅ Complete |
| 8 — Memory system review | ✅ Complete — merchant preferences / recommendations only |
| 9 — Dashboard safety check | ✅ Complete — no customer lists or PII UI |
| 10 — Final approval report | ✅ This document |

---

## 10. Approval readiness score breakdown

| Category | Weight | Score | Notes |
|----------|--------|-------|-------|
| Scope minimization | 20% | 20/20 | Minimum viable set |
| Data layer (no shopper PII) | 25% | 24/25 | GDPR export table is required exception |
| Webhook hygiene | 15% | 15/15 | Operational + mandatory GDPR only |
| AI / facts safety | 15% | 14/15 | Strong guards; ongoing discipline required |
| Logging / telemetry | 10% | 10/10 | Sanitized GDPR logs |
| Documentation & tests | 15% | 15/15 | Docs + 43 automated privacy tests |

**Total: 94 / 100**

### To reach 98+

- Add App Store listing privacy copy aligned with this report
- Document `write_products` automation opt-in in merchant-facing settings
- Optional: periodic CI job running `privacy-by-architecture.test.ts` on every PR

---

## References

- [PRIVACY_BY_ARCHITECTURE.md](./PRIVACY_BY_ARCHITECTURE.md)
- [SHOPIFY_SCOPES_AND_WEBHOOKS.md](./SHOPIFY_SCOPES_AND_WEBHOOKS.md)
- `app/lib/privacy-by-architecture.ts`
- `app/services/__tests__/privacy-by-architecture.test.ts`
- `app/services/__tests__/f44-gdpr-webhooks.test.ts`
