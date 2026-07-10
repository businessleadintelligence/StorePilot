# 11 — Billing Certification

**Date:** 2026-07-10  
**Status:** 🟡 **PARTIAL (tests only)**

## Automated test evidence

| Area | Tests | Status |
|------|-------|--------|
| Plan config | billing-config-consistency | 🟢 Pass |
| Unification | billing-unification.test.ts | 🟢 Pass |
| Entitlements | f53 | 🟢 Pass |
| Enforcement | f61, f66 | 🟢 Pass |
| Usage meters | f52 | 🟢 Pass |

## NOT VERIFIED in production

| Scenario | Status |
|----------|--------|
| Trial activation | NOT VERIFIED |
| Starter / Growth / Scale plans | NOT VERIFIED |
| Upgrade / downgrade | NOT VERIFIED |
| Cancel / reinstall | NOT VERIFIED |
| Subscription webhooks | NOT VERIFIED |
| Failed payment | NOT VERIFIED |
| Feature gates in UI | NOT VERIFIED |

## Required human action

Test billing flows in Shopify billing test mode on dev store after deploy.

## Certification result

**NOT CERTIFIED** for production billing flows.
