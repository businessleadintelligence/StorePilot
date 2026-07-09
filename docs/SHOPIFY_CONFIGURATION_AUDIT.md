# StorePilot — Shopify App Configuration Audit

**Date:** 2026-06-20  
**Scope:** `shopify.app.toml` only  
**Test result:** 2822 / 2822 passing (post-repair)

---

## Failing Tests (Before Repair)

| Test file | Test name | Root cause |
|-----------|-----------|------------|
| `privacy-by-architecture.test.ts` | requests only minimum business-intelligence scopes | Template scopes included `write_metaobjects`, `write_metaobject_definitions`; missing `read_orders` |
| `privacy-by-architecture.test.ts` | removed unused metaobject write scopes | `write_metaobjects` and `write_metaobject_definitions` present |
| `privacy-by-architecture.test.ts` | validates scope helper reports no prohibited scopes | `read_orders` missing from configured scopes |
| `privacy-by-architecture.test.ts` | registers operational catalog and order webhooks | Missing `orders/create` (and related order webhooks) |
| `privacy-by-architecture.test.ts` | registers mandatory GDPR webhooks only for compliance | Missing `customers/data_request`, `customers/redact`, `shop/redact` |
| `f614-high-elimination.test.ts` | matches runtime export and shopify.app.toml | `api_version = "2026-07"` instead of runtime `2025-10` |

**Diagnosis:** `shopify.app.toml` had been overwritten by a Shopify CLI app template (demo metafields, metaobjects, wrong API version, incomplete webhooks). Production configuration from tag `v1.0-recovered` was restored.

---

## Scopes

### Required (matches `MINIMUM_SHOPIFY_SCOPES`)

| Scope | Used by |
|-------|---------|
| `read_products` | Product Intelligence, Bundle Discovery, SEO, pricing, growth, store audit, catalog sync |
| `read_inventory` | Inventory Intelligence, stock coverage, inventory webhooks |
| `read_orders` | Aggregated revenue, AOV, order sync (no customer PII) |
| `write_products` | Automation templates (tags, SEO, publish, pricing prep) |

### Removed (template residue)

| Scope | Reason |
|-------|--------|
| `write_metaobjects` | Shopify app template demo only — no production usage |
| `write_metaobject_definitions` | Shopify app template demo only — no production usage |

### Never requested (privacy architecture)

- `read_customers` / `write_customers`
- Marketing / customer event scopes

✓ Scopes exactly match production architecture  
✓ No unnecessary permissions remain  
✓ Every requested scope is used in codebase

---

## Webhooks

| Topic | URI | Purpose | Required |
|-------|-----|---------|----------|
| `app/uninstalled` | `/webhooks/app/uninstalled` | Store cleanup on uninstall | Yes |
| `app/scopes_update` | `/webhooks/app/scopes_update` | Scope change handling | Yes |
| `app_subscriptions/update` | `/webhooks/app/subscriptions/update` | Shopify Billing subscription sync | Yes |
| `products/create` | `/webhooks/products/create` | Catalog sync | Yes |
| `products/update` | `/webhooks/products/update` | Catalog sync | Yes |
| `products/delete` | `/webhooks/products/delete` | Catalog sync | Yes |
| `inventory_levels/update` | `/webhooks/inventory/levels/update` | Inventory sync | Yes |
| `orders/create` | `/webhooks/orders/create` | Aggregated order sync | Yes |
| `orders/updated` | `/webhooks/orders/updated` | Aggregated order sync | Yes |
| `orders/cancelled` | `/webhooks/orders/cancelled` | Aggregated order sync | Yes |
| `customers/data_request` | `/webhooks/customers/data_request` | **Mandatory GDPR** | Yes (compliance) |
| `customers/redact` | `/webhooks/customers/redact` | **Mandatory GDPR** | Yes (compliance) |
| `shop/redact` | `/webhooks/shop/redact` | **Mandatory GDPR** | Yes (compliance) |

### Not registered (by design)

- `customers/create`, `customers/update` — no customer profiling; privacy tests assert absence

✓ Every webhook maps to an existing route handler  
✓ Billing webhook present for subscription lifecycle  
✓ GDPR webhooks present for App Store compliance

---

## Privacy Review

| Check | Status |
|-------|--------|
| No customer read/write scopes | ✓ |
| Orders synced without customer PII | ✓ (GraphQL queries audited in tests) |
| GDPR webhooks for compliance only | ✓ |
| No customer create/update webhooks | ✓ |
| Aligns with `docs/PRIVACY_BY_ARCHITECTURE.md` | ✓ |
| Aligns with `docs/SHOPIFY_SCOPES_AND_WEBHOOKS.md` | ✓ |

---

## Platform Alignment

| Platform | Configuration support |
|----------|----------------------|
| **AI Platform** | Product/inventory/order facts via scoped catalog + order sync |
| **Billing** | `app_subscriptions/update` webhook + no extra billing scopes (Shopify managed) |
| **Connectors** | Google/Microsoft connectors use OAuth — not Shopify scopes |
| **Automation** | `write_products` for merchant-approved catalog actions only |
| **Privacy architecture** | Minimum scopes; GDPR webhooks only where mandatory |

---

## Embedded & URLs

| Setting | Value |
|---------|-------|
| `embedded` | `true` |
| `application_url` | `https://store-pilot-eta.vercel.app` |
| `redirect_urls` | `/auth/callback`, `/api/auth/callback` (production host) |
| `api_version` | `2025-10` (matches `SHOPIFY_ADMIN_API_VERSION_STRING`) |
| `[build] automatically_update_urls_on_dev` | `true` |

---

## Approval Readiness

| Criterion | Status |
|-----------|--------|
| Minimum scopes documented and enforced | ✓ |
| No prohibited customer/marketing scopes | ✓ |
| Template demo artifacts removed | ✓ |
| Mandatory GDPR webhooks registered | ✓ |
| API version aligned with runtime | ✓ |
| Configuration matches `v1.0-recovered` baseline | ✓ |
| All audit tests passing | ✓ |

---

## Final Configuration

File: `store-pilot/shopify.app.toml`

```
scopes = "read_products,read_inventory,write_products,read_orders"
api_version = "2025-10"
embedded = true
application_url = "https://store-pilot-eta.vercel.app"
```

14 webhook subscriptions (app lifecycle, billing, catalog, inventory, orders, GDPR).

Template sections removed:
- `[product.metafields.app.demo_info]`
- `[metaobjects.app.example]`

---

## Validation

```
npm test → 2822 / 2822 PASS
```
