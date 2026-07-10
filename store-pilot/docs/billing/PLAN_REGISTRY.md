# Plan Registry

Source: `app/billing/plan-registry.ts`

## Public plans

- **starter** — $29/mo — new stores
- **growth** — $79/mo — primary plan
- **scale** — $199/mo — high-volume merchants

## Legacy mapping

| Legacy slug | Maps to |
|-------------|---------|
| pro | scale |
| agency | scale |

## Seed

`prisma/seed.ts` calls `buildDbPlanSeedRecords()` — no manual price tables.

## Shopify

Shopify subscription names containing "Pro", "Agency", or "Scale" map to the **scale** plan slug.
