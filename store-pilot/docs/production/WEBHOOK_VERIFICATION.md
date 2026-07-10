# Webhook Verification — Phase C.1

**Date:** 2026-07-10  
**Verification methods:** Codebase audit, shopify.app.toml, runtime HMAC behavior (inferred from code)

**Partner Dashboard delivery history:** **Not Verified**

---

## app/uninstalled — Handler Chain (Verified via codebase)

### What executes in production

```
POST /webhooks/app/uninstalled
  → validateWebhookRequest()          [HMAC — shopify.server.ts]
  → deactivateStoreOnUninstall(shop)    [store.server.ts — DIRECT]
  → db.session.deleteMany({ shop })     [inline in route]
  → return new Response()               [200 empty body]
```

### Canonical service handler (NOT wired to route)

```
handleAppUninstalledWebhook()
  → lookupStoreForWebhook
  → claimWebhookEvent (idempotency)
  → isStaleUninstallWebhook
  → deactivateStoreOnUninstall
  → session delete
  → finalizeWebhookClaim
  → structured retryable errors
```

**Two handlers exist. Route uses the simpler one.**

---

## Comparison Table

| Capability | Route handler | Service handler |
|------------|---------------|-----------------|
| HMAC | ✅ | ✅ (when called) |
| Idempotency | ❌ | ✅ |
| Stale uninstall protection | ❌ | ✅ |
| buildWebhookCatchResponse | ❌ | N/A |
| Uncaught deactivation → 500 | ⚠️ Yes | ✅ Caught, retryable |
| Session delete failure | 200 anyway | Retryable false success path |
| Job cancellation | ✅ via deactivate | ✅ |
| GDPR graph/memory cleanup | Partial via deactivate | Same |

---

## deactivateStoreOnUninstall Cleanup (Verified via code)

- Store: `active=false`, clear tokens
- Billing: `terminateSubscriptionOnUninstall`
- Jobs: `cancelStoreJobsOnUninstall` — **explains bootstrap job cancelled at 00:06 UTC if uninstall/reconcile triggered**
- Cache: billing cache clear
- **Does NOT explicitly:** delete graph nodes, learning profiles, adaptive memory in one transaction (separate GDPR webhooks)

**Hypothesis (not verified):** Bootstrap job cancellation at `2026-07-10T00:06:43Z` may correlate with uninstall/reconciliation — **requires webhook or application logs to confirm.**

---

## All Registered Webhooks

| Topic | Route | buildWebhookCatchResponse | Verified live |
|-------|-------|---------------------------|---------------|
| app/uninstalled | ✅ | ❌ | Not Verified |
| app/scopes_update | ✅ | — | Not Verified |
| app_subscriptions/update | ✅ | ✅ | Not Verified |
| products/create | ✅ | ✅ | Not Verified |
| products/update | ✅ | ✅ | Not Verified |
| products/delete | ✅ | ✅ | Not Verified |
| inventory_levels/update | ✅ | ✅ | Not Verified |
| orders/create | ✅ | ✅ | Not Verified |
| orders/updated | ✅ | ✅ | Not Verified |
| orders/cancelled | ✅ | ✅ | Not Verified |
| customers/data_request | ✅ | ✅ | Not Verified |
| customers/redact | ✅ | ✅ | Not Verified |
| shop/redact | ✅ | ✅ | Not Verified |
| collections/update | ❌ Not registered | — | N/A |

---

## HMAC (Verified via code)

- Invalid HMAC → **401**
- Invalid method → **405**
- Live POST without signature: **Not executed** (avoid production mutation)

---

## Recommended Canonical Handler

**Use `handleAppUninstalledWebhook` in route** — single implementation with idempotency + retry semantics.

| Field | Value |
|-------|-------|
| Severity | High |
| Evidence | Route vs service divergence; tests target service |
| Verification | Partner Dashboard 200 deliveries; f68 uninstall tests against route |

---

## Partner Dashboard

| Check | Status |
|-------|--------|
| app/uninstalled HTTP status | **Not Verified** |
| Retry count | **Not Verified** |
| Stack trace | **Not Verified** |
| customers/redact | **Not Verified** |
| shop/redact | **Not Verified** |
