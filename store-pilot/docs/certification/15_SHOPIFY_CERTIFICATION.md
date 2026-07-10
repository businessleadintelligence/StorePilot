# 15 — Shopify Certification

**Date:** 2026-07-10  
**Status:** 🔴 **NOT VERIFIED**

## Shopify reviewer checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Clean install | 🔴 NOT VERIFIED | Blocked by worker |
| OAuth | 🟡 Code complete | NOT VERIFIED E2E |
| Uninstall + cleanup | 🟡 C.2 fix local | NOT VERIFIED live |
| Billing API | 🟡 Tests pass | NOT VERIFIED live |
| Privacy policy / GDPR | 🟡 Phase B audit | Webhooks not live-tested |
| Scopes minimal | 🟢 | `read_products,read_inventory,write_products,read_orders` |
| Embedded app | 🟢 | App Bridge routes |
| Performance | 🔴 NOT VERIFIED | No metrics |
| Error handling | 🟡 | NOT VERIFIED all paths |
| Loading states | 🟡 | NOT VERIFIED |

## Reference

`docs/production/SHOPIFY_SUBMISSION_CHECKLIST.md`

## Required human action

Complete full E2E on fresh dev store; verify Partner Dashboard webhook deliveries.

## Certification result

**NOT CERTIFIED**
