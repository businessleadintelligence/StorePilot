# Business Memory

Business Memory is the persisted intelligence bundle produced by the Historical Intelligence Engine after initial ingest and graph build complete.

## Contents

```json
{
  "summary": {
    "productCount": 120,
    "orderCount": 450,
    "evidenceCount": 80,
    "graphNodeCount": 200,
    "graphEdgeCount": 350
  },
  "businessDna": { "...": "versioned profile" },
  "baselineTypes": ["revenue", "pricing", "inventory", "..."],
  "patternTypes": ["weekend_sales_lift", "order_growth", "..."]
}
```

## Storage

| Table | Role |
|-------|------|
| `historical_memory` | Current memory bundle (versioned) |
| `historical_snapshots` | Immutable point-in-time captures |
| `business_dna_versions` | Versioned DNA profiles |

## Relationship to Knowledge Graph

- **Graph** = connected operational facts with evidence provenance
- **Business Memory** = aggregated merchant understanding for future AI engines

The graph remains the source of truth for relationships. Business Memory summarizes what the merchant's business *looks like* historically.

## Lifecycle

1. Bootstrap Intelligence (4A) — estimates and initial confidence
2. Knowledge Ingest — evidence facts
3. Graph Build — nodes, edges, graph BusinessDNA node
4. **Historical Intelligence (4B)** — synthesizes Business Memory
5. Continuous Learning (4D+) — incremental memory updates

## Privacy

Memory contains aggregate operational metrics only — no customer PII.
