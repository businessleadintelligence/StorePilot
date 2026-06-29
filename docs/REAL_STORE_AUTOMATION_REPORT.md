# StorePilot — Real Store Automation Report

**Sprint:** Real Store Validation v1.0  
**Dev store:** `storepilot-dev-1mfgthy7.myshopify.com`  
**Date:** 2026-06-29  
**Overall status:** **NOT VALIDATED**

---

## Executive Summary

Automation Center could not be validated on the real development store. The `app.automation.tsx` route is **not present** in the active routes set. The `app/automation/` directory exists as **untracked WIP** in git status.

---

## Production Mutation Templates (Spec)

Per `shopify-mutation-types.ts` (when present in tree), supported templates:

| Template ID | Real-store test |
|-------------|-----------------|
| `update_product_tags` | ⏭️ NOT EXECUTED |
| `update_product_type` | ⏭️ NOT EXECUTED |
| `generate_seo_metadata` | ⏭️ NOT EXECUTED |
| `publish_draft_product` | ⏭️ NOT EXECUTED |
| `unpublish_product` | ⏭️ NOT EXECUTED |
| `apply_compare_at_price` | ⏭️ NOT EXECUTED |
| `update_product_price` | ⏭️ NOT EXECUTED |
| `move_product_between_collections` | ⏭️ NOT EXECUTED |

---

## Automation Flow Checklist

| Scenario | Status | Notes |
|----------|--------|-------|
| Preview generation | 🚫 BLOCKED | No UI route |
| Risk analysis | 🚫 BLOCKED | — |
| Rollback metadata captured | ⏭️ NOT EXECUTED | — |
| Merchant approval gate | ⏭️ NOT EXECUTED | — |
| Real Shopify mutations | ⏭️ NOT EXECUTED | Requires `write_products` scope (present in TOML) |
| Post-mutation verification | ⏭️ NOT EXECUTED | — |
| Audit trail | ⏭️ NOT EXECUTED | — |
| History view | 🚫 BLOCKED | — |
| Retry on transient failure | ⏭️ NOT EXECUTED | Rate limit helper may exist in untracked code |
| Rate limiting (429) | ⏭️ NOT EXECUTED | — |
| Idempotency (no duplicate execution) | ⏭️ NOT EXECUTED | — |
| Dry run mode | ⏭️ NOT EXECUTED | — |
| Failure handling + user messaging | ⏭️ NOT EXECUTED | — |

---

## Phase 8 — Mutation Verification Matrix

For each template, the following should be verified after execution:

| Verification | Status |
|--------------|--------|
| Shopify Admin state matches intent | ⏭️ NOT EXECUTED |
| Rollback metadata stored | ⏭️ NOT EXECUTED |
| Audit log entry | ⏭️ NOT EXECUTED |
| Automation verification rules pass | ⏭️ NOT EXECUTED |
| Dashboard reflects change | ⏭️ NOT EXECUTED |
| History updated | ⏭️ NOT EXECUTED |
| No duplicate execution on retry | ⏭️ NOT EXECUTED |

---

## Unit Test Status

| Test file | Status |
|-----------|--------|
| `shopify-automation/__tests__/shopify-executor.test.ts` | ⚠️ Not confirmed passing — suite 72/73 files failing |
| `shopify-automation/__tests__/f*` routes | ⚠️ Unknown |

---

## Scope Analysis

| Requirement | Status |
|-------------|--------|
| `write_products` for mutations | ✅ In `shopify.app.toml` |
| Collection mutations | ⏭️ Requires collection IDs from live catalog |
| Price/inventory mutations | ⚠️ `read_inventory` present; live test not run |

---

## Defects

| ID | Issue |
|----|-------|
| BUG-004 | Automation route missing |
| BUG-001 | Schema may lack automation run persistence tables |

---

## Re-validation Procedure

1. Restore `app.automation.tsx` and Automation Center nav link
2. Install app on dev store with products in catalog
3. For each template:
   - Create automation from AI recommendation or manual
   - Run preview → approve → execute
   - Verify in Shopify Admin
   - Confirm audit + rollback metadata in DB
   - Attempt duplicate execute → expect idempotent rejection
4. Induce 429 (rapid mutations) → verify backoff
5. Run dry-run → confirm zero Shopify writes

---

## Conclusion

**Automation validation: FAIL.** No real Shopify mutations executed during this sprint.
