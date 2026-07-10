# Billing Enforcement Audit — P0 Stabilization

**File:** `app/services/billing-enforcement.server.ts`  
**Production symptom:** `column "store_id" does not exist` during product webhook / upsert paths

---

## Call graph (product webhook)

```
handleProductCreateWebhook
  → upsertProductFromWebhookPayload (transactional=true)
    → applyProductWebhookWrites
      → upsertVariantRow (create path)
        → runProductCreateWithAtomicLimit
          → assertProductCreateAllowedAtomic
            → resolveProductLimitContextInTx
              → lockStoreForBilling ($queryRaw FOR UPDATE stores)
              → lockSubscriptionForBilling ($queryRaw FOR UPDATE subscriptions)  ← BUG WAS HERE
              → subscription.findUnique
              → product.count
```

---

## Raw SQL review

| Query | Purpose | Isolation | Status |
|-------|---------|-----------|--------|
| `SELECT id FROM stores WHERE id = $1 FOR UPDATE` | Serialize billing per store | Row lock on `stores` | ✅ |
| `SELECT id FROM subscriptions WHERE "storeId" = $1 FOR UPDATE` | Serialize subscription reads | Row lock on `subscriptions` | ✅ Fixed |

---

## Transaction boundaries

| Function | Transaction | Duration risk |
|----------|-------------|---------------|
| `resolveProductLimitContext` | Single `$transaction` | Low — 2 locks + 1 findUnique |
| `assertProductCreateAllowedAtomic` | Runs **inside caller tx** | Low if caller tx short |
| `checkProductCreateAllowed` | New `$transaction` per call | Medium under webhook burst |
| `runProductCreateWithAtomicLimit` | Nested tx only if root client | Webhook path uses outer tx — no double tx |

---

## Can billing block webhooks?

**Yes — when SQL fails or transaction times out:**

1. **Before fix:** `store_id` column error → entire transaction aborts → webhook throws → **HTTP 503** (retriable)
2. **After fix:** locks succeed; limit checks proceed normally
3. **Under pool exhaustion:** `Unable to start a transaction in the given time` → still **503** (separate issue — pool/contention)

---

## Improvements implemented

| Change | Rationale |
|--------|-----------|
| Fix `"storeId"` in subscription lock SQL | **Verified root cause** of SQL error |
| Add `billing-enforcement-raw-sql.test.ts` | Prevent regression |

---

## Improvements NOT changed (intentional)

- FOR UPDATE locking retained (required for TOCTOU tests in `f622-foundation-hardening.test.ts`)
- Plan limit logic unchanged
- No bypass of billing on webhooks (business rule preserved)

---

## Verification

```
npm test -- billing-enforcement-raw-sql f622-foundation-hardening
```

All billing enforcement tests pass after fix.
