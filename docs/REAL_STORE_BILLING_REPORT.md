# StorePilot — Real Store Billing Report

**Sprint:** Real Store Validation v1.0  
**Dev store:** `storepilot-dev-1mfgthy7.myshopify.com`  
**Date:** 2026-06-29  
**Overall status:** **NOT VALIDATED**

---

## Executive Summary

Billing Platform validation was **not executed** on the real development store. No billing UI route exists in the current `app/routes/` set, and `shopify.app.toml` does not register the `app_subscriptions/update` webhook.

---

## Billing Configuration (Static Audit)

| Item | Expected (StorePilot spec) | Current tree | Status |
|------|---------------------------|--------------|--------|
| Plans: Starter/Growth/Agency/Enterprise | $29/$79/$199/$399 | `SubscriptionPlan` enum: starter, growth, agency only | ⚠️ DRIFT |
| Trial days | 3 | `trialEndsAt` on Store model | ⚠️ Not verified live |
| `read_orders` for usage | Required | Missing from TOML | ❌ |
| Billing webhook | `app_subscriptions/update` | Not in TOML | ❌ |
| Billing dashboard route | `/app/billing` | Missing | ❌ |
| Test mode (`BILLING_TEST_MODE`) | Dev charging | Not in local `.env` | ⏭️ |

---

## Test Matrix

| Scenario | Status | Notes |
|----------|--------|-------|
| Trial start on install | ⏭️ NOT EXECUTED | — |
| Subscription creation (Shopify charge) | ⏭️ NOT EXECUTED | — |
| Plan upgrade | ⏭️ NOT EXECUTED | — |
| Plan downgrade | ⏭️ NOT EXECUTED | — |
| Cancellation | ⏭️ NOT EXECUTED | — |
| Usage limits enforced | ⏭️ NOT EXECUTED | `billing-enforcement.server.ts` exists — not wired |
| Blocked features + upgrade messaging | ⏭️ NOT EXECUTED | — |
| Billing webhook idempotency | ⚠️ PARTIAL | Route may exist in history; not in active TOML |
| Reinstallation billing state | ⏭️ NOT EXECUTED | — |
| Uninstall → subscription end | ⏭️ NOT EXECUTED | `app/uninstalled` webhook in TOML |
| Test mode charges | ⏭️ NOT EXECUTED | — |
| Billing dashboard UI | 🚫 BLOCKED | Route missing |
| Settings billing section | ⏭️ NOT EXECUTED | Review `app.settings.tsx` when build green |
| Pricing consistency (SSOT) | ⚠️ PARTIAL | `billing.server.ts` / `plan-config.ts` status unknown in truncated tree |

---

## Pricing Consistency Check

| Plan | Spec price | Verified in UI | Verified in Shopify charge |
|------|------------|----------------|---------------------------|
| Starter | $29/mo | ⏭️ | ⏭️ |
| Growth | $79/mo | ⏭️ | ⏭️ |
| Agency | $199/mo | ⏭️ | ⏭️ |
| Enterprise | $399/mo | ⏭️ | ⏭️ |

**Result:** **NOT VERIFIED** — cannot confirm single source of truth on live store.

---

## Webhook Flow

```
Shopify APP_SUBSCRIPTIONS_UPDATE
  → /webhooks/app/subscriptions/update
  → gateWebhookEvent (idempotency)
  → billing service state update
```

| Step | Status |
|------|--------|
| Webhook registered in Partner Dashboard | ❌ Not in TOML |
| HMAC verification | ⚠️ Unit tests only |
| Idempotent processing | ⏭️ NOT EXECUTED live |
| No double activate/cancel | ⏭️ NOT EXECUTED |

---

## Defects

| ID | Issue |
|----|-------|
| BUG-004 | Billing route missing |
| BUG-006 | Billing webhook not registered |
| BUG-008 | Production env incomplete |

---

## Re-validation Procedure

1. Restore billing routes + `plan-config.ts` SSO
2. Add `app_subscriptions/update` to `shopify.app.toml`; deploy
3. Set `BILLING_TEST_MODE=1` on dev
4. Install app → confirm trial subscription created in Shopify admin
5. Upgrade Starter → Growth → verify charge amount matches $79
6. Downgrade → verify proration behavior
7. Cancel → verify access restrictions + upgrade messaging
8. Replay billing webhook → verify no duplicate state change
9. Uninstall + reinstall → verify billing reconciliation

---

## Conclusion

**Billing validation: FAIL.** No Shopify billing charges created or verified on dev store.
