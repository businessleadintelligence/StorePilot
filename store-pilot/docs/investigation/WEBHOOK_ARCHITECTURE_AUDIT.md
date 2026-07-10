# Webhook Architecture Audit — P0 Stabilization

---

## Product webhooks (`products/create`, `update`, `delete`)

### Current flow (as deployed before this sprint's SQL fix)

```
POST /webhooks/products/create
  ↓ validateWebhookRequest (HMAC)
  ↓ handleProductCreateWebhook
      ↓ beginProductWebhook
          ↓ lookupStoreForWebhook (Store.findUnique)
          ↓ gateWebhookEvent
              ↓ claimWebhookEvent (persist WebhookEvent + lease)
      ↓ upsertProductFromWebhookPayload (prisma.$transaction)
          ↓ applyProductWebhookWrites (per variant)
              ↓ upsertVariantRow → billing lock tx → product.create/update
      ↓ markWebhookEventProcessed
      ↓ scheduleGraphUpdateFromWebhook (void async — non-blocking)
  ↓ buildWebhookActionResponse → 200 or 503
```

### Target flow (recommended future state)

```
Verify HMAC → Load store → Persist webhook event → Enqueue job → HTTP 200
```

**Gap:** Product upsert + billing enforcement still run **inline** in the webhook request. Graph scheduling is already async (`void ...catch`).

---

## HTTP 503 sources (verified in code)

| Source | Mechanism | File |
|--------|-----------|------|
| `retryable: true` in handler result | `buildWebhookActionResponse` → 503 | `webhook.server.ts:278` |
| Retriable thrown errors | `buildWebhookCatchResponse` → 503 | `webhook.server.ts:315` |
| Store not found | `beginProductWebhook` → retryable | `product.server.ts` |
| Lease contention | `lease_active` / pool timeout | `webhook.server.ts` |
| **Billing SQL error** | Transaction abort → throw → 503 | `billing-enforcement.server.ts` (**fixed**) |
| **Transaction timeout** | P2028 / pool P2024 → 503 | Under burst + `connection_limit=1` |

---

## Order webhooks

Routes: `webhooks.orders.create`, `updated`, `cancelled`  
Pattern: Same gate/claim → inline upsert with billing atomic checks.

---

## Inventory webhooks

Route: `webhooks.inventory.levels.update`  
Pattern: Gate/claim → inline inventory update (may call Shopify GraphQL on retriable miss).

---

## Existing protections (already implemented)

| Protection | Implementation |
|------------|----------------|
| HMAC validation | `validateWebhookRequest` |
| Idempotency | `shopifyWebhookId` unique + `claimWebhookEvent` |
| Duplicate skip | `processedSuccessfully` check |
| Lease | `processingOwner` + 5 min expiry |
| Dedup | Unique constraint race handling |

---

## Recommended follow-up (NOT implemented — requires job type)

Enqueue `JobType.product_webhook_process` after claim, return 200 immediately. Worker runs `applyProductWebhookWrites`. **NOT VERIFIED** in this sprint — documented for Phase 2 hardening.

---

## Files reviewed

- `app/routes/webhooks.products.create.tsx`
- `app/routes/webhooks.products.update.tsx`
- `app/routes/webhooks.products.delete.tsx`
- `app/services/product.server.ts` (handlers)
- `app/services/webhook.server.ts` (gate/claim/503)
