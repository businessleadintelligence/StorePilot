# Upgrade Flow

1. Feature gate detects unavailable feature via `getFeatureAvailability()`.
2. Workspace shows `FeatureUpgradePanel` with plan name and CTA.
3. Merchant navigates to `/app/billing` or Settings → Billing.
4. Plan cards use registry-derived pricing.
5. Shopify approval required for paid upgrade.

Components: `app/components/billing/FeatureGate.tsx`
