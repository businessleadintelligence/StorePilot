# Confidence Seeds

Domain-level confidence scores synthesized after historical import — bridging bootstrap estimates with evidence and graph coverage.

## Formula

```
confidencePercent = min(98, bootstrapBaseline + historicalBoost)

historicalBoost = factCoverage × 25 + evidenceCoverage × 15 + graphCoverage × 10
```

## Domains

| Domain | Evidence Fact Types |
|--------|---------------------|
| inventory | InventoryLow, InventoryCritical, HighInventory, OutOfStock |
| products | NeverSold, RecentlyPublished, InactiveProduct, Discontinued |
| pricing | PriceChanged, MarginRiskCandidate, PriceAboveCategoryAverage |
| seo | MissingSEO, MissingMetaDescription, MissingAltText, NoDescription |
| collections | SingleProductCollection, OrphanCollection |
| operations | RefundRiskSeed, OrderImported |
| seasonality | SeasonalCandidate |

## Example After Historical Import

| Domain | Bootstrap | After Historical |
|--------|-----------|------------------|
| Inventory | 70% | 85% |
| Products | 68% | 82% |
| Pricing | 50% | 68% |
| SEO | 42% | 58% |
| Seasonality | 22% | 38% |

Overall confidence typically reaches **70–85%** after first historical run.

## Storage

`confidence_seeds` — one row per `(storeId, domain)`.

Also updates `learning_readiness` domain confidence columns and advances stage to `learning`.

## Relation to Bootstrap (4A)

Bootstrap provides `baselinePercent` from catalog metadata alone.

Confidence Seeds add evidence and graph coverage after full historical import.
