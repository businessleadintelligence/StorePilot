# Webhook Validation — Phase C

**Date:** 2026-07-10  
**Status:** ⚠️ **PARTIAL** — routes and HMAC exist; `app/uninstalled` handler gap; live delivery not re-tested.

---

## Registered Webhooks (shopify.app.toml)

| Topic | URI | Route file | Handler pattern |
|-------|-----|------------|-----------------|
| app/uninstalled | `/webhooks/app/uninstalled` | `webhooks.app.uninstalled.tsx` | **Direct deactivate** ⚠️ |
| app/scopes_update | `/webhooks/app/scopes_update` | `webhooks.app.scopes_update.tsx` | Shopify authenticate |
| app_subscriptions/update | `/webhooks/app/subscriptions/update` | `webhooks.app.subscriptions.update.tsx` | Billing + catch |
| products/create | `/webhooks/products/create` | `webhooks.products.create.tsx` | Action + catch |
| products/update | `/webhooks/products/update` | `webhooks.products.update.tsx` | Action + catch |
| products/delete | `/webhooks/products/delete` | `webhooks.products.delete.tsx` | Action + catch |
| inventory_levels/update | `/webhooks/inventory/levels/update` | `webhooks.inventory.levels.update.tsx` | Action + catch |
| orders/create | `/webhooks/orders/create` | `webhooks.orders.create.tsx` | Action + catch |
| orders/updated | `/webhooks/orders/updated` | `webhooks.orders.updated.tsx` | Action + catch |
| orders/cancelled | `/webhooks/orders/cancelled` | `webhooks.orders.cancelled.tsx` | Action + catch |
| customers/data_request | `/webhooks/customers/data_request` | `webhooks.customers.data_request.tsx` | GDPR + catch |
| customers/redact | `/webhooks/customers/redact` | `webhooks.customers.redact.tsx` | GDPR + catch |
| shop/redact | `/webhooks/shop/redact` | `webhooks.shop.redact.tsx` | GDPR + catch |

### Not configured (user checklist item)

| Topic | Status |
|-------|--------|
| collections/update | ❌ **Not in shopify.app.toml** — no route file |

---

## HMAC & Authentication

**Implementation:** `validateWebhookRequest()` in `app/shopify.server.ts`

- Invalid HMAC → **401 Unauthorized**
- Invalid method → **405**
- Other validation errors → **400**

**Live POST without HMAC:** Not executed in Phase C (avoid mutating production). Code path returns 401 for invalid HMAC.

---

## app/uninstalled — Investigation

### Current route behavior

```typescript
// app/routes/webhooks.app.uninstalled.tsx
await deactivateStoreOnUninstall(shop);
await db.session.deleteMany({ where: { shop } });
return new Response(); // 200, empty body
```

### Service-layer handler (NOT used by route)

`handleAppUninstalledWebhook()` in `app/services/store.server.ts` provides:
- Webhook idempotency (`claimWebhookEvent`)
- Stale uninstall protection (`isStaleUninstallWebhook`)
- Retryable error responses
- Structured logging

### Why deliveries may fail (code analysis)

| Failure mode | HTTP | Shopify retries? | Evidence |
|--------------|------|------------------|----------|
| Invalid HMAC | 401 | No | `validateWebhookRequest` |
| `deactivateStoreOnUninstall` throws (DB error) | **500 uncaught** | **Yes** | Route has **no** try/catch around deactivate |
| Missing `buildWebhookCatchResponse` | Inconsistent 5xx | Yes | Other webhooks use catch wrapper; uninstall does not |
| Session delete fails | **200 anyway** | No | Caught, logged, still returns 200 |

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Location** | `app/routes/webhooks.app.uninstalled.tsx` |
| **Root Cause** | Route bypasses `handleAppUninstalledWebhook`; uncaught errors from `deactivateStoreOnUninstall` return 500 |
| **Evidence** | Route diff vs `webhooks.customers.redact.tsx`; tests cover service handler not route |
| **Risk** | Shopify retry storms; partial deactivation; compliance gaps on idempotency |
| **Recommended Fix** | Route calls `handleAppUninstalledWebhook` + `buildWebhookCatchResponse` |
| **Estimated Fix Time** | 2 hours |
| **Owner** | Backend |
| **Verification** | Partner Dashboard delivery success; test f68 uninstall suite against route |

**Stack trace in production:** ❌ **Not available in Phase C** — requires Vercel logs or Shopify delivery history.

**Response code for reported failures:** Likely **500** if deactivation throws; **401** if secret/HMAC mismatch — **cannot confirm without Partner Dashboard logs**.

---

## Compliance Webhooks

| Webhook | Idempotency | Service | Catch wrapper |
|---------|-------------|---------|---------------|
| customers/redact | ✅ via gdpr.server | `handleCustomersRedactWebhook` | ✅ |
| shop/redact | ✅ | gdpr handlers | ✅ |
| customers/data_request | ✅ | gdpr handlers | ✅ |

**Privacy:** Redact handlers in `app/services/gdpr.server.ts` — covered in Phase B audit.

---

## Product / Order / Inventory Webhooks

| Capability | Status |
|------------|--------|
| HMAC | ✅ |
| Idempotency | ✅ via webhook event claims (product/order handlers) |
| Worker enqueue | ✅ on relevant topics |
| Retry handling | ✅ `buildWebhookCatchResponse` → 503 retriable |

**Live delivery:** ❌ Not verified in Phase C.

---

## Webhook Verification Matrix

| Webhook | Route exists | HMAC | Idempotency | Worker enqueue | Live OK |
|---------|--------------|------|-------------|----------------|---------|
| app/uninstalled | ✅ | ✅ | ❌ Route skips | ✅ cancel jobs in deactivate | ❓ |
| customers/redact | ✅ | ✅ | ✅ | N/A | ❓ |
| shop/redact | ✅ | ✅ | ✅ | N/A | ❓ |
| orders/create | ✅ | ✅ | ✅ | ✅ | ❓ |
| orders/update | ✅ | ✅ | ✅ | ✅ | ❓ |
| products/create | ✅ | ✅ | ✅ | ✅ | ❓ |
| products/update | ✅ | ✅ | ✅ | ✅ | ❓ |
| inventory/update | ✅ | ✅ | ✅ | ✅ | ❓ |
| collections/update | ❌ N/A | — | — | — | N/A |

---

## Recommended Pre-Submission Actions

1. Wire `app/uninstalled` route to `handleAppUninstalledWebhook`
2. Export webhook delivery success from Shopify Partner Dashboard (last 7 days)
3. Confirm all URIs return 200 on valid test payloads from Shopify CLI `webhook trigger`
