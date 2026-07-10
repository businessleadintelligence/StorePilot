# Webhook Reliability — Phase C.2

## Problem

`webhooks.app.uninstalled.tsx` bypassed canonical handler:

- No webhook idempotency claim
- No stale uninstall detection
- No structured retry response
- Duplicate session cleanup logic

## Fix

Route now delegates entirely to `handleAppUninstalledWebhook()`:

```typescript
const result = await handleAppUninstalledWebhook({
  shop,
  topic,
  webhookId,
  webhookTriggeredAt,
});

if (!result.success && result.retryable) return 500;
if (!result.success) return 422;
return 200;
```

## Canonical Flow (`store.server.ts`)

1. `lookupStoreForWebhook(shop)`
2. `claimWebhookEvent()` — idempotency
3. Duplicate → 200 success
4. `isStaleUninstallWebhook()` → ignore stale
5. `deactivateStoreOnUninstall()` → store deactivate + `cancelStoreJobsOnUninstall`
6. Session cleanup
7. `finalizeWebhookClaim()`

## Response Codes

| Case | HTTP |
|------|------|
| Success | 200 |
| Duplicate | 200 |
| Stale (ignored) | 200 |
| Retryable failure | 500 (Shopify retries) |
| Permanent failure | 422 |

## GDPR / Cleanup

Single path ensures:

- Store deactivated, tokens cleared
- All queued/claimed/running/retrying jobs cancelled
- Onboarding reset on uninstall
- Billing lifecycle recorded

## Verification

- Existing foundation tests: `f622-foundation-hardening.test.ts`
- Manual: Shopify webhook delivery log shows 200 on uninstall
