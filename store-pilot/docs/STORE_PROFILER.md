# Store Profiler

Lightweight Shopify GraphQL profiling for bootstrap intelligence.

## Query Strategy

Single compound query — **counts and samples only**:

```graphql
query StorePilotBootstrapProfile {
  shop { createdAt }
  productsCount { count }
  productVariantsCount { count }
  collectionsCount { count }
  ordersCount { count }
  locationsCount { count }
  productTags(first: 250) { nodes }
  products(first: 25) {
    nodes {
      vendor
      variantsCount { count }
    }
  }
  orders(first: 1, sortKey: CREATED_AT, reverse: false) {
    nodes { createdAt }
  }
  recentOrders: orders(first: 1, sortKey: CREATED_AT, reverse: true) {
    nodes { createdAt }
  }
}
```

## Derived Metrics

| Metric | Derivation |
|--------|------------|
| `averageVariantsPerProduct` | Sample mean or variants/products ratio |
| `vendorsCount` | Unique vendors in 25-product sample |
| `estimatedHistoryMonths` | Oldest order → now (capped at 120) |
| `storeAgeDays` | Shop createdAt → now |

## Store Size Classification

| Tier | Product Count |
|------|---------------|
| Tiny | ≤ 50 |
| Small | ≤ 500 |
| Medium | ≤ 5,000 |
| Large | ≤ 25,000 |
| Enterprise | > 25,000 |

## Complexity Scores (0–1)

- **Catalog complexity** — log-scaled products, variants, tags
- **Historical depth** — months of orders + order volume
- **Operational complexity** — locations, vendors, collections

## Rules

- No product titles, descriptions, or customer fields in profiler
- Fail fast on GraphQL errors — marks `bootstrapStatus: failed`
- Idempotent — safe to re-run on reinstall via worker job

## Module

`app/learning/bootstrap/store-profiler/store-profiler.ts`
