# Entitlements

All entitlements derive from the plan registry:

1. `normalizePlanSlug()` resolves DB/Shopify slug (including legacy pro/agency).
2. `getResolvedPlanLimit()` returns enforcement limits.
3. `getStoreEntitlements()` always applies registry limits, not stale DB values.

Files:

- `app/services/store-entitlements-loader.server.ts`
- `app/services/entitlements.server.ts`
- `app/billing/feature-gates.server.ts`
- `app/billing/billing-engine.ts`
