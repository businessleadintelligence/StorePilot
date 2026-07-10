# Privacy Architecture Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Design Principle: Privacy by Architecture

Documented in `docs/PRIVACY_BY_ARCHITECTURE.md`. StorePilot stores **business intelligence**, not shopper CRM profiles.

**Core commitments:**
- No `Customer` model in schema
- Order sync excludes customer ID, email, phone, address, notes
- Minimum Shopify scopes: `read_products, read_inventory, write_products, read_orders`
- GDPR webhooks mandatory and implemented

---

## Data Classification by Model Category

### No Shopper PII (by design)

| Category | Models | Stored |
|----------|--------|--------|
| Commerce aggregates | Order, OrderLineItem | Order GID, name, financial totals, line item titles/SKU |
| Products | Product | Title, SKU, price, inventory |
| Intelligence | Prediction, RootCause, Experiment, Evidence, etc. | Business metrics, evidence IDs — no identity columns |
| Knowledge Graph | KnowledgeGraphNode/Edge | Entity relationships |

### Merchant/Staff PII (required for app function)

| Model | Fields | Retention |
|-------|--------|-----------|
| User | email, name | Until shop/redact |
| Session | firstName, lastName, email, tokens | Until uninstall/redact |
| GoogleIntegration | email, OAuth tokens | Until disconnect/redact |

### Compliance-only customer reference

| Model | Fields | Retention |
|-------|--------|-----------|
| CustomerDataExport | shopifyCustomerId, exportPayload | Until customers/redact or shop/redact |

---

## PII Field Matrix (High-Risk Models)

| Model | Email | Phone | Name | Address | Payment | Customer ID |
|-------|-------|-------|------|---------|---------|-------------|
| Customer | ❌ N/A | ❌ | ❌ | ❌ | ❌ | ❌ No model |
| Order | ❌ | ❌ | ❌ | ❌ | Totals only | ❌ |
| OrderLineItem | ❌ | ❌ | ❌ | ❌ | Unit prices | ❌ |
| User | ✅ Merchant | ❌ | ✅ | ❌ | ❌ | ❌ |
| Session | ✅ Staff | ❌ | ✅ | ❌ | ❌ | ❌ |
| CustomerDataExport | ❌ (declared false) | ❌ | ❌ | ❌ | Order totals in export | ✅ GID only |

---

## Privacy Controls (Implemented)

| Control | File |
|---------|------|
| Order GraphQL excludes customer fields | `app/services/orders.server.ts` |
| Prohibited field scanner | `app/lib/privacy-by-architecture.ts` |
| Privacy regression tests | `app/services/__tests__/privacy-by-architecture.test.ts` |
| Log context sanitization | `sanitizeLogContext()` |
| Export scoped to webhook order GIDs | `gdpr.server.ts` |
| Export route requires admin auth + store ownership | `app.compliance.customer-export.$exportId.tsx` |

---

## Data Minimization Report

**Strengths:**
- No customer profile table
- No marketing/analytics cookies stored
- Webhook payloads not persisted (`WebhookEvent` stores metadata only)
- Intelligence JSON has no dedicated PII columns

**Gaps:**

| Gap | Risk | Recommendation |
|-----|------|----------------|
| JSON blobs could contain PII if guards fail | Medium | Write-time schema validation on Evidence/AI outputs |
| `orderName` persisted and exported | Low | Acceptable as order identifier, not person |
| `CustomerDataExport` retains financial data until redact | Low | Add TTL or auto-delete after 30 days |
| SyncJob/JobEvent payloads unvalidated | Low | Audit payload schemas |

---

## Data Retention Report

| Data | Retention Policy | Mechanism |
|------|------------------|-----------|
| Store data | Until shop/redact (~48h after uninstall) | GDPR webhook |
| Sessions | Cleared on uninstall; deleted on shop/redact | `store.server.ts`, `gdpr.server.ts` |
| Access tokens | Cleared on uninstall | `store.server.ts` |
| Customer exports | Until customers/redact | `gdpr.server.ts` |
| Intelligence data | Indefinite until shop/redact | **Gap — incomplete deletion** |
| AI telemetry | Per aiAgentRun retention — no auto-purge documented | Add retention job |

---

## Privacy Score: 88/100

Strong architectural privacy design. Deduction for incomplete shop/redact and JSON blob drift risk.
