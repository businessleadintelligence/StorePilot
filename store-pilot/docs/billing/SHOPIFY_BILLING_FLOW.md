# Shopify Billing Flow

1. Merchant selects plan on `/app/billing`.
2. `createShopifySubscription()` uses registry price via `getCanonicalPlan()`.
3. Shopify `AppSubscriptionCreate` charge uses test mode when configured.
4. Webhook `app/subscriptions/update` → `syncInternalPlanFromShopify()`.
5. Plan slug normalized via `normalizePlanSlug()` (pro/agency → scale).
6. Subscription row updated; entitlements read registry limits.

See `app/billing/shopify-billing.server.ts`.
