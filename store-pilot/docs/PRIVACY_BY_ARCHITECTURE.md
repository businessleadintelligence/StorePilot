# Privacy-by-Architecture

StorePilot is an **AI Operating System for Shopify Stores**. It is not a CRM, customer analytics platform, or marketing automation product.

## Definition

StorePilot must never collect, store, expose, or process personally identifiable customer information unless absolutely required for a core platform obligation (for example, mandatory GDPR webhook compliance).

If a feature can be implemented using **aggregated business metrics** instead of customer-level information, aggregated metrics must always be chosen.

## Equal architectural principles

Privacy-by-Architecture is equal in importance to:

- Deterministic calculations first
- LLM explains, never calculates
- Structured JSON outputs
- Provider abstraction
- Frozen AI Platform modules
- Merchant approval before automation
- Read-only dashboards (no AI execution on load)

## Intelligence scope

StorePilot intelligence is built around:

- Products
- Inventory
- Orders (aggregated financial and line-item data)
- Revenue
- Pricing
- Bundles
- SEO
- Store audit
- Growth
- Store performance
- Operations

**Not customers.**

## Prohibited customer PII in product data paths

The following must not appear in database tables (except GDPR compliance), fact builders, LLM prompts, cache keys, telemetry, logs, dashboards, or automation templates:

- Customer names
- Customer emails
- Phone numbers
- Physical addresses
- Shipping or billing details
- Customer notes
- Marketing consent flags
- Customer tags
- Shopify customer IDs (except transient GDPR export/redact correlation)

## Permitted aggregated substitutes

Use these instead of customer identity:

- Revenue totals and trends
- Order counts
- Average order value
- Refund totals
- Products sold and variant performance
- Returning customer **ratio** (percentage, not identity)
- Repeat purchase **rate**
- Conversion proxies
- Collection performance
- Product performance

## Order storage policy

Orders may be stored only as aggregated commerce records:

| Keep | Remove |
|------|--------|
| Order ID (Shopify GID) | Customer ID |
| Revenue, tax, discount, refund totals | Customer name, email, phone |
| Line items (product, variant, SKU, qty, price) | Shipping/billing address |
| Created/updated/processed dates | Order notes with PII |
| Financial and fulfillment status | Any field identifying a person |

`orderName` (for example `#1042`) is a store order label, not customer identity.

## Shopify scopes (minimum)

```
read_products
read_inventory
write_products
read_orders
```

Scopes intentionally **not** requested:

- `read_customers` / `write_customers`
- `read_marketing` / marketing automation scopes
- Unused template scopes (`write_metaobjects`, `write_metaobject_definitions`)

## Webhooks

**Operational:** products, inventory, orders, app lifecycle.

**Mandatory compliance:** `customers/data_request`, `customers/redact`, `shop/redact`.

Customer webhooks exist only for GDPR. They do not enable customer profiling.

## AI agents

All specialist agents and Executive COO:

- Read persisted outputs and aggregated metrics only
- Never execute another agent during fact building
- Never receive customer PII in facts or prompts

## Memory

Memory stores merchant preferences, dismissed/implemented recommendations, workflow history, and execution history — never customer identity.

## Automation

Automation templates may only prepare changes to products, inventory, collections, SEO, images, pricing, bundles, tags, publish/archive, and theme content. They must never email or SMS customers or modify customer profiles.

## GDPR

`CustomerDataExport` exists solely to satisfy Shopify mandatory GDPR webhooks. Exports contain order aggregates linked by Shopify order IDs from the webhook payload, not stored customer profiles.
