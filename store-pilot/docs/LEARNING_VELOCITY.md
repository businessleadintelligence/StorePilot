# Learning Velocity

Every intelligence domain has a **velocity tier** that drives UI labels, scheduler priority, and merchant expectations.

## Tiers

| Tier | Meaning | Example Domains |
|------|---------|-----------------|
| **Fast** | Ready within first hour after historical import | Inventory, Products |
| **Medium** | Improves over first 1–3 days | Pricing, SEO, Collections, Operations |
| **Slow** | Requires weeks of observation or pattern engine | Seasonality, Vendor Reliability, Refund Behaviour, Elasticity |

## Status Labels

| Label | When |
|-------|------|
| Ready | Fast domain + confidence ≥ 65% |
| Learning | Fast domain building |
| Improving | Medium domain with partial confidence |
| Discovering | Slow domain with early signals |
| Not Ready | Insufficient historical signal |

## UI Example

```
Inventory Intelligence    Ready        74%
Products Intelligence     Ready        71%
Pricing Intelligence      Improving    56%
SEO Intelligence          Learning     48%
Seasonality Intelligence  Discovering  22%
Executive COO             Not Ready
Prediction                Not Ready
```

## Scheduler Impact

Fast domains align with top `learning_priorities` entries (revenue, inventory).

Slow domains (seasonality) enqueue last during trial bootstrap.

## Storage

`learning_velocity` table — one row per `(storeId, domain)`.

Assigned deterministically in `assignLearningVelocities()` during bootstrap.
