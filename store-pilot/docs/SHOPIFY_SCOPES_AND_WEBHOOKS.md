# Shopify Scopes and Webhooks — Privacy Hardening Audit

## Access scopes

| Scope | Purpose | Mandatory | Removable |
|-------|---------|-----------|-----------|
| `read_products` | Product Intelligence, Bundle Discovery, SEO, pricing, growth, store audit | Yes | No |
| `read_inventory` | Inventory Intelligence, stock coverage, bundle inventory | Yes | No |
| `write_products` | Automation templates (tags, SEO metadata, publish, pricing prep) | Yes | No |
| `read_orders` | Aggregated revenue, AOV, refunds, line-item velocity | Yes | No |

### Removed (template residue, unused in production)

| Scope | Reason removed |
|-------|----------------|
| `write_metaobjects` | Demo template only; no production usage |
| `write_metaobject_definitions` | Demo template only; no production usage |

### Never requested

- `read_customers` / `write_customers` — StorePilot does not profile customers
- Marketing / customer event scopes — not a marketing automation app

## Webhooks

| Topic | Purpose | Required | Removable |
|-------|---------|----------|-----------|
| `app/uninstalled` | Cleanup on uninstall | Yes | No |
| `app/scopes_update` | Scope change sync | Yes | No |
| `products/create` | Catalog sync | Yes | No |
| `products/update` | Catalog sync | Yes | No |
| `products/delete` | Catalog sync | Yes | No |
| `inventory_levels/update` | Inventory sync | Yes | No |
| `orders/create` | Aggregated order sync | Yes | No |
| `orders/updated` | Aggregated order sync | Yes | No |
| `orders/cancelled` | Aggregated order sync | Yes | No |
| `customers/data_request` | **Mandatory GDPR** | Yes (compliance) | No |
| `customers/redact` | **Mandatory GDPR** | Yes (compliance) | No |
| `shop/redact` | **Mandatory GDPR** | Yes (compliance) | No |

Customer GDPR webhooks do not enable customer analytics. They fulfill Shopify App Store mandatory compliance only.

See also: [SHOPIFY_APP_STORE_APPROVAL_REPORT.md](./SHOPIFY_APP_STORE_APPROVAL_REPORT.md)

See also: [SHOPIFY_APP_STORE_APPROVAL_REPORT.md](./SHOPIFY_APP_STORE_APPROVAL_REPORT.md)
