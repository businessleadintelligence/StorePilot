# Billing Architecture

StorePilot billing is unified around **`app/billing/plan-registry.ts`**.

## Flow

```
Plan Registry (plan-registry.ts)
  → Feature Matrix (FEATURE_REGISTRY)
  → Limit Matrix (per-plan limits)
  → Pricing (monthly/annual)
  → Website (`/api/pricing`, buildWebsitePricingModel)
  → Dashboard (BillingDashboard)
  → Billing Service / Shopify Billing
  → Entitlements (store-entitlements-loader)
  → Feature Gates (feature-gates.server.ts)
  → AI Cost Limits (ai-cost-control via registry limits)
  → Worker Queue Tier (worker-queue-tier.server.ts)
```

## Public plans

| Slug | Name | Price |
|------|------|-------|
| starter | Starter | $29/mo |
| growth | Growth | $79/mo |
| scale | Scale | $199/mo |

Legacy slugs `pro` and `agency` normalize to **scale** for backward compatibility.

## Rules

1. Never hardcode prices outside `plan-registry.ts`.
2. Never hardcode feature flags outside the registry.
3. Never hardcode limits outside the registry.
4. Database `plans` rows are seeded via `buildDbPlanSeedRecords()`.
5. Runtime enforcement uses registry limits via `normalizePlanSlug()` even when DB rows are stale.

## Extensibility

The registry supports adding a fourth public tier later without redesign. Only `PUBLIC_PLAN_SLUGS` and UI visibility need updating.
