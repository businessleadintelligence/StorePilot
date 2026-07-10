# 07 — Shopify Sync Certification

**Date:** 2026-07-10  
**Status:** 🔴 **NOT VERIFIED**

## Requirement

Fresh Shopify development store only. No reuse of `storepilot-pe9x0muw` or prior test stores.

## Sync domains

| Domain | Production verified | Evidence |
|--------|---------------------|----------|
| OAuth / install | 🔴 NOT VERIFIED | Requires fresh install post-deploy |
| Products | 🔴 NOT VERIFIED | C.1: 0 products in prod DB |
| Variants | 🔴 NOT VERIFIED | — |
| Collections | 🔴 NOT VERIFIED | Route exists; sync not traced |
| Inventory | 🔴 NOT VERIFIED | — |
| Orders | 🔴 NOT VERIFIED | — |
| Images | 🔴 NOT VERIFIED | — |
| SEO | 🔴 NOT VERIFIED | — |
| Prices / vendors | 🔴 NOT VERIFIED | — |
| Metafields | 🔴 NOT VERIFIED | — |
| Markets / currencies | 🔴 NOT VERIFIED | — |

## Local test evidence

- `product.server.ts`, `inventory.server.ts`, `orders.server.ts` — unit/integration tests pass in suite
- Billing enforcement tests (f61, f66) cover blocked paths

## Required human action

1. Deploy worker + app
2. Create **new** dev store in Partner Dashboard
3. Install app
4. Wait for onboarding 100%
5. Verify counts in dashboard + DB

## Verification SQL

```sql
SELECT COUNT(*) FROM products WHERE "storeId" = '<id>';
SELECT COUNT(*) FROM orders WHERE "storeId" = '<id>';
```

## Certification result

**NOT CERTIFIED**
