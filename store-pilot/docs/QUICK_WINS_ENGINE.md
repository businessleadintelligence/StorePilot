# Quick Wins Engine

Sprint 4C delivers deterministic quick wins during the 3-day trial. No GPT. Every win is derived from knowledge graph evidence and historical memory.

## Pipeline position

```
knowledge_graph_build
  → historical_intelligence
    → quick_wins_generate
      → learning_readiness.stage = operational
```

The worker schedules `quick_wins_generate` immediately after `historical_intelligence` completes.

## Module layout

```
app/learning/quick-wins/
  generator/     Orchestrates detection, scoring, persistence
  scoring/       Business impact, confidence, urgency, rank score
  impact/        Revenue opportunity estimation from merchant baselines
  ranking/       Composite ranking and trial highlights
  prioritizer/   Trial-first category ordering
  catalog/       Catalog-specific detectors (slow moving)
  seo/           SEO win definitions
  inventory/     Inventory win definitions
  pricing/       Pricing win definitions
  collections/   Collection win definitions
  operations/    Operations win definitions
  shared/        Types, constants, evidence loader
  api/           Read API for dashboard and agents
  scheduler/     Worker job scheduling
  ui/            UI mapping exports
  __tests__/     Deterministic unit tests
```

## Win types

Each win type maps to one or more evidence fact types:

| Win Type | Evidence Facts |
|----------|----------------|
| missing_seo | MissingSEO |
| missing_meta_description | MissingMetaDescription |
| missing_alt_text | MissingAltText |
| no_description | NoDescription |
| no_images | LowMediaCoverage |
| low_stock | InventoryLow, InventoryCritical |
| out_of_stock | OutOfStock |
| inventory_risk | InventoryLow, InventoryCritical, OutOfStock |
| overstock | HighInventory |
| never_sold_product | NeverSold |
| dead_product | NeverSold, InactiveProduct, Discontinued |
| slow_moving_product | NeverSold ∩ HighInventory (entity intersection) |
| inactive_product | InactiveProduct |
| draft_too_long | DraftTooLong |
| bundle_candidate | BundleCandidateSeed |
| pricing_outlier | PriceAboveCategoryAverage, PriceChanged |
| margin_risk | MarginRiskCandidate |
| collection_issue | OrphanCollection, SingleProductCollection |
| high_refund_risk | RefundRiskSeed |

## Persistence

- `quick_wins` — one row per win type per store (upserted on each generation)
- `quick_win_summary` — aggregate headline, total wins, estimated revenue opportunity

## API

```typescript
import { getQuickWinsForUi } from "~/learning/quick-wins/api/quick-wins-api";

const summary = await getQuickWinsForUi(storeId, "USD");
```

## UI

Dashboard renders `QuickWinsCard` when quick wins exist:

- "We already found" highlight list
- Estimated monthly revenue opportunity
- Top ranked opportunities with impact, confidence, and revenue

## Design rules

- No AI / no GPT
- Every win includes source evidence IDs and fact types
- Idempotent regeneration (deactivates stale wins, upserts current)
- Trial value visible within first hour after historical import
