# Webhook Burst Protection — P0 Stabilization

---

## Fresh install behavior

When a merchant installs StorePilot, Shopify sends a **burst** of `products/create` webhooks (one per product or batch). Each triggers a separate Vercel serverless invocation.

---

## Existing protections

| Layer | Mechanism | File |
|-------|-----------|------|
| Idempotency | `shopifyWebhookId` unique | `webhook.server.ts` |
| Claim lease | 5 min processing owner | `claimWebhookEvent` |
| Duplicate skip | `processedSuccessfully` | `isDuplicateWebhook` |
| Inactive store defer | retryable 503 | `gateWebhookEvent` |
| Lease busy defer | retryable 503 | `acquireWebhookProcessingLease` |

---

## Gap: inline heavy processing

Each webhook still runs:

- Full product upsert transaction
- Billing FOR UPDATE locks (2× per new variant)
- Product create/update

With `connection_limit=1`, **N webhooks ≈ N × transaction wait queue**.

---

## Verified fix (this sprint)

**`store_id` → `"storeId"` in billing lock** — stops immediate SQL failure that caused Shopify to retry webhooks, **multiplying** burst pressure.

---

## Recommended architecture (future — NOT implemented)

```
HMAC → store lookup → claimWebhookEvent → enqueueJob(product_webhook) → HTTP 200
Worker → applyProductWebhookWrites → markWebhookEventProcessed
```

Requires new `JobType` + worker case + payload schema.

---

## Backpressure options (partial / existing)

| Option | Status |
|--------|--------|
| Shopify retry on 503 | Existing (undesirable under error) |
| Dedup by webhookId | ✅ Existing |
| Single onboarding bootstrap job | ✅ `onboarding_bootstrap` — products sync via worker |
| Skip webhook upsert when bootstrap job running | **NOT implemented** |

---

## Concurrency limit recommendation

Until enqueue refactor:

1. Rely on bootstrap worker for bulk catalog sync
2. Webhooks update individual products post-bootstrap
3. Monitor 503 rate after `store_id` fix — should drop sharply

---

## Verification

| Criterion | Status |
|-----------|--------|
| No 503 on product webhooks during fresh install | **NOT VERIFIED** |
| No SQL `store_id` errors | ✅ Fixed in code + test |
